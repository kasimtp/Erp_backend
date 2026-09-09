import Customer from "../models/Customer.js";
import AppError from "../utils/AppError.js";

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
export const getCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single customer by ID
// @route   GET /api/customers/:id
// @access  Private
export const getCustomerById = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return next(new AppError("Customer not found", 404));
    }
    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new customer
// @route   POST /api/customers
// @access  Private
export const createCustomer = async (req, res, next) => {
  try {
    const { name, email, phone, company, address, taxId, creditLimit } = req.body;
    if (!name) {
      return next(new AppError("Customer name is required", 400));
    }

    const customer = await Customer.create({
      name: name.trim(),
      email: email ? email.toLowerCase().trim() : "",
      phone: phone ? phone.trim() : "",
      company: company ? company.trim() : "",
      address: address ? address.trim() : "",
      taxId: taxId ? taxId.trim() : "",
      creditLimit: creditLimit || 0,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
export const updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return next(new AppError("Customer not found", 404));
    }

    const fields = ["name", "email", "phone", "company", "address", "taxId", "creditLimit", "status"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) customer[f] = req.body[f];
    });

    await customer.save();

    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private
export const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      return next(new AppError("Customer not found", 404));
    }
    res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
