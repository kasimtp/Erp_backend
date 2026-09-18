import Customer from "../models/Customer.js";
import Product from "../models/Product.js";
import Quotation from "../models/Quotation.js";
import SaleDocument from "../models/SaleDocument.js";
import AppError from "../utils/AppError.js";

// @desc    Get all quotations
// @route   GET /api/quotations
// @access  Private
export const getQuotations = async (req, res, next) => {
  try {
    const { status, search, startDate, endDate } = req.query;
    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { quotationNumber: regex },
        { documentNumber: regex },
        { customerName: regex },
        { notes: regex },
      ];
    }

    const quotations = await Quotation.find(filter)
      .populate("customer")
      .populate("items.product")
      .populate("convertedInvoice")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: quotations.length,
      data: quotations,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get quotation summary metrics
// @route   GET /api/quotations/metrics
// @access  Private
export const getQuotationMetrics = async (req, res, next) => {
  try {
    const quotes = await Quotation.find();

    let totalQuoted = 0;
    let approvedQuoted = 0;
    let pendingQuoted = 0;
    let approvedCount = 0;
    let pendingCount = 0;
    let draftCount = 0;

    quotes.forEach((q) => {
      const amt = q.grandTotal || 0;
      totalQuoted += amt;
      if (q.status === "approved" || q.status === "completed" || q.isConverted) {
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

// @desc    Get single quotation by ID
// @route   GET /api/quotations/:id
// @access  Private
export const getQuotationById = async (req, res, next) => {
  try {
    const quote = await Quotation.findById(req.params.id)
      .populate("customer")
      .populate("items.product")
      .populate("convertedInvoice");

    if (!quote) {
      return next(new AppError("Quotation not found in database", 404));
    }

    res.status(200).json({
      success: true,
      data: quote,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new quotation in 'quotations' collection
// @route   POST /api/quotations
// @access  Private
export const createQuotation = async (req, res, next) => {
  try {
    const {
      customerId,
      items = [],
      validUntil,
      dueDate,
      notes = "",
      terms = "",
      status = "sent",
    } = req.body;

    if (!customerId) {
      return next(new AppError("Please select a valid customer for the quotation", 400));
    }

    if (!items || !items.length) {
      return next(new AppError("Please add at least one line item to the quotation", 400));
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return next(new AppError("Selected customer not found in database", 404));
    }

    // Auto-generate QUO sequence
    const latestDoc = await Quotation.findOne({
      quotationNumber: /^QUO-[0-9]+$/,
    }).sort({ quotationNumber: -1 });

    let nextSeq = 1001;
    if (latestDoc && latestDoc.quotationNumber) {
      const parts = latestDoc.quotationNumber.split("-");
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) {
        nextSeq = num + 1;
      }
    }

    let quotationNumber = `QUO-${nextSeq}`;
    while (await Quotation.exists({ quotationNumber })) {
      nextSeq++;
      quotationNumber = `QUO-${nextSeq}`;
    }

    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;
    const processedItems = [];

    for (const item of items) {
      const prod = await Product.findById(item.productId || item.product);
      if (!prod) {
        return next(new AppError("Product item not found in catalog", 404));
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
    }

    const grandTotal = Math.round((subtotal - discountTotal + taxTotal) * 100) / 100;
    const validity = validUntil || dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const quote = await Quotation.create({
      quotationNumber,
      documentNumber: quotationNumber,
      documentType: "quotation",
      customer: customer._id,
      customerName: customer.name,
      items: processedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      discountTotal: Math.round(discountTotal * 100) / 100,
      grandTotal,
      status,
      validUntil: validity,
      dueDate: validity,
      notes,
      terms: terms || undefined,
      createdBy: req.user._id,
    });

    const populated = await Quotation.findById(quote._id)
      .populate("customer")
      .populate("items.product");

    res.status(201).json({
      success: true,
      message: `Quotation ${quotationNumber} stored successfully in MongoDB 'quotations' collection`,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update quotation status
// @route   PATCH /api/quotations/:id/status
// @access  Private
export const updateQuotationStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return next(new AppError("Please provide a valid status", 400));
    }

    const quote = await Quotation.findById(req.params.id);
    if (!quote) {
      return next(new AppError("Quotation not found in database", 404));
    }

    quote.status = status;
    await quote.save();

    res.status(200).json({
      success: true,
      message: `Quotation status updated to ${status}`,
      data: quote,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Convert quotation to sales invoice
// @route   POST /api/quotations/:id/convert-to-invoice
// @access  Private
export const convertQuotationToInvoice = async (req, res, next) => {
  try {
    const quote = await Quotation.findById(req.params.id);
    if (!quote) {
      return next(new AppError("Quotation document not found in MongoDB", 404));
    }

    const customer = await Customer.findById(quote.customer);
    if (!customer) {
      return next(new AppError("Customer associated with this quote not found", 404));
    }

    // Generate INV number
    const latestDoc = await SaleDocument.findOne({
      documentNumber: /^INV-[0-9]+$/,
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

    // Deduct inventory stock for line items
    for (const item of quote.items) {
      const prod = await Product.findById(item.product);
      if (prod) {
        prod.stockQuantity = Math.max(0, prod.stockQuantity - (item.quantity || 1));
        await prod.save();
      }
    }

    // Update customer debt balance
    customer.balance = (customer.balance || 0) + quote.grandTotal;
    await customer.save();

    // Create Invoice in saledocuments
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
      notes: `Converted from Quotation ${quote.quotationNumber}. ${quote.notes || ""}`.trim(),
      createdBy: req.user._id,
    });

    // Mark quotation as approved & converted
    quote.status = "approved";
    quote.isConverted = true;
    quote.convertedInvoice = invoice._id;
    await quote.save();

    const populatedInvoice = await SaleDocument.findById(invoice._id)
      .populate("customer")
      .populate("items.product");

    res.status(201).json({
      success: true,
      message: `Quotation ${quote.quotationNumber} successfully converted to Invoice ${documentNumber}`,
      data: {
        invoice: populatedInvoice,
        quotation: quote,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete quotation
// @route   DELETE /api/quotations/:id
// @access  Private
export const deleteQuotation = async (req, res, next) => {
  try {
    const quote = await Quotation.findByIdAndDelete(req.params.id);
    if (!quote) {
      return next(new AppError("Quotation not found in database", 404));
    }

    res.status(200).json({
      success: true,
      message: "Quotation deleted successfully from MongoDB",
    });
  } catch (error) {
    next(error);
  }
};
