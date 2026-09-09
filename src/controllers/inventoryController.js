import Product from "../models/Product.js";
import StockAdjustment from "../models/StockAdjustment.js";
import StockTransaction from "../models/StockTransaction.js";
import AppError from "../utils/AppError.js";

// @desc    Get stock list with valuation
// @route   GET /api/inventory/stock
// @access  Private
export const getStockList = async (req, res, next) => {
  try {
    const products = await Product.find().sort({ stockQuantity: 1 });
    const formatted = products.map((p) => ({
      _id: p._id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      stockQuantity: p.stockQuantity,
      unit: p.unit,
      minStockAlert: p.minStockAlert,
      stockValue: Math.round((p.costPrice || 0) * (p.stockQuantity || 0) * 100) / 100,
      status: p.status,
    }));

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get low stock items list
// @route   GET /api/inventory/low-stock
// @access  Private
export const getLowStockList = async (req, res, next) => {
  try {
    const products = await Product.find({
      $expr: { $lte: ["$stockQuantity", "$minStockAlert"] },
    }).sort({ stockQuantity: 1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get stock movement transactions
// @route   GET /api/inventory/transactions
// @access  Private
export const getStockTransactions = async (req, res, next) => {
  try {
    const transactions = await StockTransaction.find()
      .populate("product")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get stock adjustments history
// @route   GET /api/inventory/adjustments
// @access  Private
export const getStockAdjustments = async (req, res, next) => {
  try {
    const adjustments = await StockAdjustment.find()
      .populate("product")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: adjustments.length,
      data: adjustments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create stock adjustment (Increase / Decrease stock)
// @route   POST /api/inventory/adjustments
// @access  Private
export const createStockAdjustment = async (req, res, next) => {
  try {
    const { productId, adjustmentType, quantity, reason, notes } = req.body;
    const qty = Number(quantity);

    if (!productId) {
      return next(new AppError("Please select a product", 400));
    }
    if (!qty || qty <= 0) {
      return next(new AppError("Adjustment quantity must be greater than zero", 400));
    }
    if (!["increase", "decrease"].includes(adjustmentType)) {
      return next(new AppError("Invalid adjustment type (must be increase or decrease)", 400));
    }

    const prod = await Product.findById(productId);
    if (!prod) {
      return next(new AppError("Product not found", 404));
    }

    const previousStock = prod.stockQuantity || 0;
    let newStock = previousStock;

    if (adjustmentType === "increase") {
      newStock = previousStock + qty;
    } else {
      newStock = Math.max(0, previousStock - qty);
    }

    prod.stockQuantity = newStock;
    await prod.save();

    const count = await StockAdjustment.countDocuments();
    const adjustmentNumber = `ADJ-${1001 + count}`;

    const adjustment = await StockAdjustment.create({
      adjustmentNumber,
      product: prod._id,
      productName: prod.name,
      sku: prod.sku,
      adjustmentType,
      quantity: qty,
      previousStock,
      newStock,
      reason: reason || "Audit Count Correction",
      notes: notes ? notes.trim() : "",
      createdBy: req.user._id,
    });

    // Record stock transaction log
    await StockTransaction.create({
      product: prod._id,
      productName: prod.name,
      sku: prod.sku,
      type: "adjustment",
      quantity: adjustmentType === "increase" ? qty : -qty,
      previousStock,
      newStock,
      reason: reason || "Stock Adjustment",
      referenceNumber: adjustmentNumber,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: `Stock successfully adjusted (${adjustmentType.toUpperCase()} ${qty} ${prod.unit}). New stock: ${newStock}`,
      data: {
        adjustment,
        product: prod,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get inventory summary metrics
// @route   GET /api/inventory/metrics
// @access  Private
export const getInventoryMetrics = async (req, res, next) => {
  try {
    const products = await Product.find();

    let totalStockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach((p) => {
      const stock = p.stockQuantity || 0;
      totalStockValue += (p.costPrice || 0) * stock;

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= (p.minStockAlert || 5)) {
        lowStockCount++;
      }
    });

    const adjustmentsCount = await StockAdjustment.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        totalStockValue: Math.round(totalStockValue * 100) / 100,
        totalItemsCount: products.length,
        lowStockCount,
        outOfStockCount,
        adjustmentsCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
