import Product from "../models/Product.js";
import PurchaseDocument from "../models/PurchaseDocument.js";
import Supplier from "../models/Supplier.js";
import SupplierPayment from "../models/SupplierPayment.js";
import AppError from "../utils/AppError.js";

const typePrefixMap = {
  purchaseOrder: "PO",
  supplierBill: "BILL",
  purchaseReturn: "PRET",
};

// @desc    Get purchase documents list
// @route   GET /api/purchases
// @access  Private
export const getPurchases = async (req, res, next) => {
  try {
    const { documentType } = req.query;
    const filter = {};
    if (documentType) {
      filter.documentType = documentType;
    }

    const purchases = await PurchaseDocument.find(filter)
      .populate("supplier")
      .populate("items.product")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get purchase summary metrics
// @route   GET /api/purchases/metrics
// @access  Private
export const getPurchaseMetrics = async (req, res, next) => {
  try {
    const docs = await PurchaseDocument.find();

    let totalPurchases = 0;
    let totalPayable = 0;
    let openOrdersCount = 0;
    let dueBillsCount = 0;

    docs.forEach((doc) => {
      totalPurchases += doc.grandTotal || 0;
      totalPayable += doc.balanceDue || 0;

      if (doc.documentType === "purchaseOrder" && doc.status !== "completed") {
        openOrdersCount++;
      }
      if (doc.documentType === "supplierBill" && doc.paymentStatus !== "paid") {
        dueBillsCount++;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        totalPurchases: Math.round(totalPurchases * 100) / 100,
        totalPayable: Math.round(totalPayable * 100) / 100,
        openOrdersCount,
        dueBillsCount,
        totalCount: docs.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single purchase document by ID
// @route   GET /api/purchases/:id
// @access  Private
export const getPurchaseById = async (req, res, next) => {
  try {
    const purchase = await PurchaseDocument.findById(req.params.id)
      .populate("supplier")
      .populate("items.product");

    if (!purchase) {
      return next(new AppError("Purchase document not found", 404));
    }

    const payments = await SupplierPayment.find({ purchaseDocument: purchase._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        ...purchase.toObject(),
        payments,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new purchase document (PO, Supplier Bill, Return) with Automated Stock-In
// @route   POST /api/purchases
// @access  Private
export const createPurchase = async (req, res, next) => {
  try {
    const {
      documentType = "purchaseOrder",
      supplierId,
      items = [],
      dueDate,
      notes = "",
      status = "received",
    } = req.body;

    if (!supplierId) {
      return next(new AppError("Please select a supplier", 400));
    }

    if (!items || !items.length) {
      return next(new AppError("Please add at least one line item", 400));
    }

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return next(new AppError("Supplier not found", 404));
    }

    const prefix = typePrefixMap[documentType] || "PO";
    const latestDoc = await PurchaseDocument.findOne({
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
    while (await PurchaseDocument.exists({ documentNumber })) {
      nextSeq++;
      documentNumber = `${prefix}-${nextSeq}`;
    }

    let subtotal = 0;
    let taxTotal = 0;
    const processedItems = [];

    for (const item of items) {
      const prod = await Product.findById(item.productId || item.product);
      if (!prod) {
        return next(new AppError("Product not found", 404));
      }

      const qty = Number(item.quantity) || 1;
      const unitCost = Number(item.unitCost !== undefined ? item.unitCost : prod.costPrice);
      const taxRate = Number(item.taxRate) || 0;

      const itemSubtotal = qty * unitCost;
      const itemTax = itemSubtotal * (taxRate / 100);
      const itemTotal = itemSubtotal + itemTax;

      subtotal += itemSubtotal;
      taxTotal += itemTax;

      processedItems.push({
        product: prod._id,
        productName: prod.name,
        sku: prod.sku,
        quantity: qty,
        unitCost,
        taxRate,
        total: Math.round(itemTotal * 100) / 100,
      });

      // Stock-In: Increase stock on PO / Supplier Bill
      if (documentType === "purchaseOrder" || documentType === "supplierBill") {
        prod.stockQuantity = (prod.stockQuantity || 0) + qty;
        await prod.save();
      } else if (documentType === "purchaseReturn") {
        prod.stockQuantity = Math.max(0, (prod.stockQuantity || 0) - qty);
        await prod.save();
      }
    }

    const grandTotal = Math.round((subtotal + taxTotal) * 100) / 100;
    const balanceDue = grandTotal;

    const purchaseDoc = await PurchaseDocument.create({
      documentType,
      documentNumber,
      supplier: supplier._id,
      supplierName: supplier.name,
      items: processedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      grandTotal,
      amountPaid: 0,
      balanceDue,
      paymentStatus: "unpaid",
      status,
      dueDate: dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      notes,
      createdBy: req.user._id,
    });

    // Update supplier payable balance
    supplier.payableBalance = (supplier.payableBalance || 0) + grandTotal;
    await supplier.save();

    const populated = await PurchaseDocument.findById(purchaseDoc._id)
      .populate("supplier")
      .populate("items.product");

    res.status(201).json({
      success: true,
      message: "Purchase document created successfully and stock updated",
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record payment to supplier for purchase bill
// @route   POST /api/purchases/:id/payments
// @access  Private
export const recordSupplierPayment = async (req, res, next) => {
  try {
    const { amount, paymentMethod = "bankTransfer", referenceNumber = "", notes = "" } = req.body;
    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      return next(new AppError("Payment amount must be greater than zero", 400));
    }

    const purchaseDoc = await PurchaseDocument.findById(req.params.id);
    if (!purchaseDoc) {
      return next(new AppError("Purchase document not found", 404));
    }

    if (purchaseDoc.paymentStatus === "paid" || purchaseDoc.balanceDue <= 0) {
      return next(new AppError("Purchase bill is already fully paid", 400));
    }

    const latestPayment = await SupplierPayment.findOne({
      paymentNumber: /^PPAY-[0-9]+$/
    }).sort({ paymentNumber: -1 });

    let nextSeq = 1001;
    if (latestPayment && latestPayment.paymentNumber) {
      const parts = latestPayment.paymentNumber.split("-");
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) {
        nextSeq = num + 1;
      }
    }

    let paymentNumber = `PPAY-${nextSeq}`;
    while (await SupplierPayment.exists({ paymentNumber })) {
      nextSeq++;
      paymentNumber = `PPAY-${nextSeq}`;
    }

    const payment = await SupplierPayment.create({
      paymentNumber,
      purchaseDocument: purchaseDoc._id,
      supplier: purchaseDoc.supplier,
      amount: paymentAmount,
      paymentMethod,
      referenceNumber: referenceNumber.trim(),
      notes: notes.trim(),
      paidBy: req.user._id,
    });

    purchaseDoc.amountPaid = Math.round((purchaseDoc.amountPaid + paymentAmount) * 100) / 100;
    purchaseDoc.balanceDue = Math.max(0, Math.round((purchaseDoc.grandTotal - purchaseDoc.amountPaid) * 100) / 100);

    if (purchaseDoc.balanceDue <= 0) {
      purchaseDoc.paymentStatus = "paid";
    } else {
      purchaseDoc.paymentStatus = "partial";
    }

    await purchaseDoc.save();

    // Update supplier payable balance
    const supplier = await Supplier.findById(purchaseDoc.supplier);
    if (supplier) {
      supplier.payableBalance = Math.max(0, Math.round(((supplier.payableBalance || 0) - paymentAmount) * 100) / 100);
      await supplier.save();
    }

    res.status(201).json({
      success: true,
      message: "Supplier payment recorded successfully",
      data: {
        payment,
        purchaseDocument: purchaseDoc,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete purchase document
// @route   DELETE /api/purchases/:id
// @access  Private
export const deletePurchase = async (req, res, next) => {
  try {
    const purchase = await PurchaseDocument.findByIdAndDelete(req.params.id);
    if (!purchase) {
      return next(new AppError("Purchase document not found", 404));
    }

    await SupplierPayment.deleteMany({ purchaseDocument: req.params.id });

    res.status(200).json({
      success: true,
      message: "Purchase document deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
