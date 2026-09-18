import Customer from "../models/Customer.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import SaleDocument from "../models/SaleDocument.js";
import AppError from "../utils/AppError.js";

// Helper to generate document prefix
const typePrefixMap = {
  invoice: "INV",
  quotation: "QUO",
  salesOrder: "SO",
  salesReturn: "RET",
};

// @desc    Get sales documents list (filtered by type)
// @route   GET /api/sales
// @access  Private
export const getSales = async (req, res, next) => {
  try {
    const { documentType } = req.query;
    const filter = {};
    if (documentType) {
      filter.documentType = documentType;
    }

    const sales = await SaleDocument.find(filter)
      .populate("customer")
      .populate("items.product")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get sales summary metrics
// @route   GET /api/sales/metrics
// @access  Private
export const getSalesMetrics = async (req, res, next) => {
  try {
    const invoices = await SaleDocument.find({ documentType: "invoice" });

    let totalInvoiced = 0;
    let totalReceived = 0;
    let totalOutstanding = 0;

    invoices.forEach((inv) => {
      totalInvoiced += inv.grandTotal || 0;
      totalReceived += inv.amountPaid || 0;
      totalOutstanding += inv.balanceDue || 0;
    });

    const quotationCount = await SaleDocument.countDocuments({ documentType: "quotation" });
    const orderCount = await SaleDocument.countDocuments({ documentType: "salesOrder" });
    const returnCount = await SaleDocument.countDocuments({ documentType: "salesReturn" });

    res.status(200).json({
      success: true,
      data: {
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        totalReceived: Math.round(totalReceived * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        totalInvoicesCount: invoices.length,
        quotationCount,
        orderCount,
        returnCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single sale document by ID
// @route   GET /api/sales/:id
// @access  Private
export const getSaleById = async (req, res, next) => {
  try {
    const sale = await SaleDocument.findById(req.params.id)
      .populate("customer")
      .populate("items.product");

    if (!sale) {
      return next(new AppError("Sale document not found", 404));
    }

    const payments = await Payment.find({ saleDocument: sale._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        ...sale.toObject(),
        payments,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new sale document (Invoice, Quotation, Order, Return)
// @route   POST /api/sales
// @access  Private
export const createSale = async (req, res, next) => {
  try {
    const {
      documentType = "invoice",
      customerId,
      items = [],
      dueDate,
      notes = "",
      status = "sent",
    } = req.body;

    if (!customerId) {
      return next(new AppError("Please select a valid customer", 400));
    }

    if (!items || !items.length) {
      return next(new AppError("Please add at least one line item to the document", 400));
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return next(new AppError("Selected customer not found", 404));
    }

    const prefix = typePrefixMap[documentType] || "INV";
    const latestDoc = await SaleDocument.findOne({
      documentNumber: new RegExp(`^${prefix}-[0-9]+$`)
    }).sort({ documentNumber: -1 });

    let nextSeq = 1001;
    if (latestDoc && latestDoc.documentNumber) {
      const parts = latestDoc.documentNumber.split("-");
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) {
        nextSeq = num + 1;
      }
    }

    let documentNumber = `${prefix}-${nextSeq}`;
    while (await SaleDocument.exists({ documentNumber })) {
      nextSeq++;
      documentNumber = `${prefix}-${nextSeq}`;
    }

    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;
    const processedItems = [];

    for (const item of items) {
      const prod = await Product.findById(item.productId || item.product);
      if (!prod) {
        return next(new AppError(`Product not found for item`, 404));
      }

      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice !== undefined ? item.unitPrice : prod.sellingPrice);
      const taxRate = Number(item.taxRate) || 0;
      const discountRate = Number(item.discountRate) || 0;

      const itemSubtotal = qty * price;
      const itemDiscount = itemSubtotal * (discountRate / 100);
      const itemTax = (itemSubtotal - itemDiscount) * (taxRate / 100);
      const itemTotal = itemSubtotal - itemDiscount + itemTax;

      subtotal += itemSubtotal;
      discountTotal += itemDiscount;
      taxTotal += itemTax;

      processedItems.push({
        product: prod._id,
        productName: prod.name,
        sku: prod.sku,
        quantity: qty,
        unitPrice: price,
        taxRate,
        discountRate,
        total: Math.round(itemTotal * 100) / 100,
      });

      // Deduct stock for Invoices & Orders
      if (documentType === "invoice" || documentType === "salesOrder") {
        prod.stockQuantity = Math.max(0, prod.stockQuantity - qty);
        await prod.save();
      } else if (documentType === "salesReturn") {
        prod.stockQuantity = prod.stockQuantity + qty;
        await prod.save();
      }
    }

    const grandTotal = Math.round((subtotal - discountTotal + taxTotal) * 100) / 100;
    const balanceDue = grandTotal;

    const saleDoc = await SaleDocument.create({
      documentType,
      documentNumber,
      customer: customer._id,
      customerName: customer.name,
      items: processedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      discountTotal: Math.round(discountTotal * 100) / 100,
      grandTotal,
      amountPaid: 0,
      balanceDue,
      paymentStatus: "unpaid",
      status,
      dueDate: dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      notes,
      createdBy: req.user._id,
    });

    // Update customer outstanding balance for invoices
    if (documentType === "invoice") {
      customer.balance = (customer.balance || 0) + grandTotal;
      await customer.save();
    }

    const populated = await SaleDocument.findById(saleDoc._id)
      .populate("customer")
      .populate("items.product");

    res.status(201).json({
      success: true,
      message: `${documentType.charAt(0).toUpperCase() + documentType.slice(1)} created successfully`,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record payment for sale invoice
// @route   POST /api/sales/:id/payments
// @access  Private
export const recordPayment = async (req, res, next) => {
  try {
    const { amount, paymentMethod = "cash", referenceNumber = "", notes = "" } = req.body;
    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      return next(new AppError("Payment amount must be greater than zero", 400));
    }

    const saleDoc = await SaleDocument.findById(req.params.id);
    if (!saleDoc) {
      return next(new AppError("Sale document not found", 404));
    }

    if (saleDoc.paymentStatus === "paid" || saleDoc.balanceDue <= 0) {
      return next(new AppError("Invoice is already fully paid", 400));
    }

    const latestPayment = await Payment.findOne({
      paymentNumber: /^PAY-[0-9]+$/
    }).sort({ paymentNumber: -1 });

    let nextSeq = 1001;
    if (latestPayment && latestPayment.paymentNumber) {
      const parts = latestPayment.paymentNumber.split("-");
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) {
        nextSeq = num + 1;
      }
    }

    let paymentNumber = `PAY-${nextSeq}`;
    while (await Payment.exists({ paymentNumber })) {
      nextSeq++;
      paymentNumber = `PAY-${nextSeq}`;
    }

    const payment = await Payment.create({
      paymentNumber,
      saleDocument: saleDoc._id,
      customer: saleDoc.customer,
      amount: paymentAmount,
      paymentMethod,
      referenceNumber: referenceNumber.trim(),
      notes: notes.trim(),
      receivedBy: req.user._id,
    });

    saleDoc.amountPaid = Math.round((saleDoc.amountPaid + paymentAmount) * 100) / 100;
    saleDoc.balanceDue = Math.max(0, Math.round((saleDoc.grandTotal - saleDoc.amountPaid) * 100) / 100);

    if (saleDoc.balanceDue <= 0) {
      saleDoc.paymentStatus = "paid";
    } else {
      saleDoc.paymentStatus = "partial";
    }

    await saleDoc.save();

    // Update customer balance
    const customer = await Customer.findById(saleDoc.customer);
    if (customer) {
      customer.balance = Math.max(0, Math.round(((customer.balance || 0) - paymentAmount) * 100) / 100);
      await customer.save();
    }

    res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      data: {
        payment,
        saleDocument: saleDoc,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete sale document
// @route   DELETE /api/sales/:id
// @access  Private
export const deleteSale = async (req, res, next) => {
  try {
    const sale = await SaleDocument.findByIdAndDelete(req.params.id);
    if (!sale) {
      return next(new AppError("Sale document not found", 404));
    }

    // Delete associated payment records
    await Payment.deleteMany({ saleDocument: req.params.id });

    res.status(200).json({
      success: true,
      message: "Sale document deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get quotation specific metrics
// @route   GET /api/sales/quotations/metrics
// @access  Private
export const getQuotationMetrics = async (req, res, next) => {
  try {
    const quotes = await SaleDocument.find({ documentType: "quotation" });

    let totalQuoted = 0;
    let approvedQuoted = 0;
    let pendingQuoted = 0;
    let approvedCount = 0;
    let pendingCount = 0;
    let draftCount = 0;

    quotes.forEach((q) => {
      const amt = q.grandTotal || 0;
      totalQuoted += amt;
      if (q.status === "approved" || q.status === "completed") {
        approvedCount++;
        approvedQuoted += amt;
      } else if (q.status === "draft") {
        draftCount++;
      } else {
        pendingCount++;
        pendingQuoted += amt;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        totalCount: quotes.length,
        totalQuoted: Math.round(totalQuoted * 100) / 100,
        approvedCount,
        approvedQuoted: Math.round(approvedQuoted * 100) / 100,
        pendingCount,
        pendingQuoted: Math.round(pendingQuoted * 100) / 100,
        draftCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Convert quotation to sales invoice
// @route   POST /api/sales/:id/convert-to-invoice
// @access  Private
export const convertQuotationToInvoice = async (req, res, next) => {
  try {
    const quote = await SaleDocument.findById(req.params.id);
    if (!quote) {
      return next(new AppError("Quotation document not found", 404));
    }

    if (quote.documentType !== "quotation") {
      return next(new AppError("Only quotations can be converted to invoices", 400));
    }

    const customer = await Customer.findById(quote.customer);
    if (!customer) {
      return next(new AppError("Customer not found for quotation", 404));
    }

    // Generate INV number
    const latestDoc = await SaleDocument.findOne({
      documentNumber: new RegExp("^INV-[0-9]+$"),
    }).sort({ documentNumber: -1 });

    let nextSeq = 1001;
    if (latestDoc && latestDoc.documentNumber) {
      const parts = latestDoc.documentNumber.split("-");
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) {
        nextSeq = num + 1;
      }
    }

    let documentNumber = `INV-${nextSeq}`;
    while (await SaleDocument.exists({ documentNumber })) {
      nextSeq++;
      documentNumber = `INV-${nextSeq}`;
    }

    // Deduct stock for each line item
    for (const item of quote.items) {
      const prod = await Product.findById(item.product);
      if (prod) {
        prod.stockQuantity = Math.max(0, prod.stockQuantity - (item.quantity || 1));
        await prod.save();
      }
    }

    // Update customer outstanding debt balance
    customer.balance = (customer.balance || 0) + quote.grandTotal;
    await customer.save();

    // Create new Invoice
    const invoice = await SaleDocument.create({
      documentType: "invoice",
      documentNumber,
      customer: customer._id,
      customerName: customer.name,
      items: quote.items,
      subtotal: quote.subtotal,
      taxTotal: quote.taxTotal,
      discountTotal: quote.discountTotal,
      grandTotal: quote.grandTotal,
      amountPaid: 0,
      balanceDue: quote.grandTotal,
      paymentStatus: "unpaid",
      status: "sent",
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      notes: `Converted from Quotation ${quote.documentNumber}. ${quote.notes || ""}`.trim(),
      createdBy: req.user._id,
    });

    // Mark quotation as approved
    quote.status = "approved";
    await quote.save();

    const populatedInvoice = await SaleDocument.findById(invoice._id)
      .populate("customer")
      .populate("items.product");

    res.status(201).json({
      success: true,
      message: `Quotation ${quote.documentNumber} successfully converted to Invoice ${documentNumber}`,
      data: {
        invoice: populatedInvoice,
        quotation: quote,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update sale document status
// @route   PATCH /api/sales/:id/status
// @access  Private
export const updateSaleStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return next(new AppError("Please provide a valid status", 400));
    }

    const sale = await SaleDocument.findById(req.params.id);
    if (!sale) {
      return next(new AppError("Document not found", 404));
    }

    sale.status = status;
    await sale.save();

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: sale,
    });
  } catch (error) {
    next(error);
  }
};

