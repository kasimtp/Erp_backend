import Supplier from "../models/Supplier.js";
import AppError from "../utils/AppError.js";

// @desc    Get all suppliers
// @route   GET /api/suppliers
// @access  Private
export const getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await Supplier.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: suppliers.length,
      data: suppliers,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single supplier by ID
// @route   GET /api/suppliers/:id
// @access  Private
export const getSupplierById = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return next(new AppError("Supplier not found", 404));
    }
    res.status(200).json({
      success: true,
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new supplier
// @route   POST /api/suppliers
// @access  Private
export const createSupplier = async (req, res, next) => {
  try {
    const { name, company, email, phone, address, taxId } = req.body;
    if (!name) {
      return next(new AppError("Supplier name is required", 400));
    }

    const supplier = await Supplier.create({
      name: name.trim(),
      company: company ? company.trim() : "",
      email: email ? email.toLowerCase().trim() : "",
      phone: phone ? phone.trim() : "",
      address: address ? address.trim() : "",
      taxId: taxId ? taxId.trim() : "",
      payableBalance: 0,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update supplier
// @route   PUT /api/suppliers/:id
// @access  Private
export const updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return next(new AppError("Supplier not found", 404));
    }

    const fields = ["name", "company", "email", "phone", "address", "taxId", "status"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) supplier[f] = req.body[f];
    });

    await supplier.save();

    res.status(200).json({
      success: true,
      message: "Supplier updated successfully",
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete supplier
// @route   DELETE /api/suppliers/:id
// @access  Private
export const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) {
      return next(new AppError("Supplier not found", 404));
    }
    res.status(200).json({
      success: true,
      message: "Supplier deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
