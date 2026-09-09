import Product from "../models/Product.js";
import AppError from "../utils/AppError.js";

// @desc    Get all products
// @route   GET /api/products
// @access  Private
export const getProducts = async (req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Private
export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return next(new AppError("Product not found", 404));
    }
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private
export const createProduct = async (req, res, next) => {
  try {
    const { sku, name, category, description, costPrice, sellingPrice, stockQuantity, minStockAlert, unit } = req.body;
    if (!name) {
      return next(new AppError("Product name is required", 400));
    }

    const generateSku = sku ? sku.toUpperCase().trim() : `SKU-${Math.floor(1000 + Math.random() * 9000)}`;

    const existing = await Product.findOne({ sku: generateSku });
    if (existing) {
      return next(new AppError("Product with this SKU already exists", 400));
    }

    const product = await Product.create({
      sku: generateSku,
      name: name.trim(),
      category: category ? category.trim() : "General",
      description: description ? description.trim() : "",
      costPrice: costPrice || 0,
      sellingPrice: sellingPrice || 0,
      stockQuantity: stockQuantity || 0,
      minStockAlert: minStockAlert || 5,
      unit: unit || "pcs",
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    const fields = ["sku", "name", "category", "description", "costPrice", "sellingPrice", "stockQuantity", "minStockAlert", "unit", "status"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) product[f] = req.body[f];
    });

    await product.save();

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return next(new AppError("Product not found", 404));
    }
    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
