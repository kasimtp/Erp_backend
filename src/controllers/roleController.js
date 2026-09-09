import Role from "../models/Role.js";
import AppError from "../utils/AppError.js";

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private
export const getRoles = async (req, res, next) => {
  try {
    const roles = await Role.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: roles.length,
      data: roles,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single role by ID
// @route   GET /api/roles/:id
// @access  Private
export const getRoleById = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return next(new AppError("Role not found", 404));
    }
    res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new custom role
// @route   POST /api/roles
// @access  Private
export const createRole = async (req, res, next) => {
  try {
    const { name, description, permissions } = req.body;
    if (!name) {
      return next(new AppError("Role name is required", 400));
    }

    const existing = await Role.findOne({ name: new RegExp(`^${name.trim()}$`, "i") });
    if (existing) {
      return next(new AppError("Role with this name already exists", 400));
    }

    const role = await Role.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      permissions: permissions || [],
      isSystemRole: false,
    });

    res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: role,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update role
// @route   PUT /api/roles/:id
// @access  Private
export const updateRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return next(new AppError("Role not found", 404));
    }

    const { name, description, permissions } = req.body;
    if (name) role.name = name.trim();
    if (description !== undefined) role.description = description.trim();
    if (permissions !== undefined) role.permissions = permissions;

    await role.save();

    res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: role,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete custom role
// @route   DELETE /api/roles/:id
// @access  Private
export const deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return next(new AppError("Role not found", 404));
    }

    if (role.isSystemRole) {
      return next(new AppError("System roles cannot be deleted", 400));
    }

    await Role.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
