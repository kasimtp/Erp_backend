import Role from "../models/Role.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import generateToken from "../utils/generateToken.js";
import { getEffectivePermissions } from "../utils/permissionUtils.js";

// Helper to format consistent auth payload
const formatAuthPayload = (userDoc, token) => {
  const permissions = getEffectivePermissions(userDoc);
  const roleObj = userDoc.role;
  const roleName = roleObj ? (typeof roleObj === "object" ? roleObj.name : String(roleObj)) : "Staff";
  const roleId = roleObj ? (typeof roleObj === "object" ? roleObj._id : roleObj) : null;

  return {
    token,
    user: {
      id: userDoc._id,
      name: userDoc.name,
      email: userDoc.email,
      phone: userDoc.phone || "",
      role: {
        id: roleId,
        name: roleName,
      },
      roleName,
      status: userDoc.status,
      permissionOverrides: userDoc.permissionOverrides || [],
      permissions,
    },
  };
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return next(new AppError("Please provide name, email and password", 400));
    }

    if (password.length < 8) {
      return next(new AppError("Password must contain at least eight characters", 400));
    }

    const emailLower = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return next(new AppError("User with this email already exists", 400));
    }

    // Default role assignment for public registration
    let defaultRole = await Role.findOne({ name: "Sales Staff" }) || await Role.findOne({ isSystemRole: true });

    const user = await User.create({
      name: name.trim(),
      email: emailLower,
      phone: phone ? phone.trim() : "",
      password,
      role: defaultRole ? defaultRole._id : "Sales Staff",
      status: "active",
    });

    const populatedUser = await User.findById(user._id).populate("role");
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: formatAuthPayload(populatedUser, token),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError("Please provide email and password", 400));
    }

    const emailLower = email.toLowerCase().trim();
    let user = await User.findOne({ email: emailLower }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return next(new AppError("Invalid email or password. Please check your details or register a new account.", 401));
    }

    if (user.status !== "active") {
      return next(new AppError("User account is inactive. Please contact admin.", 401));
    }

    // Safely resolve role if stored as string in DB
    if (user.role && typeof user.role === "string") {
      let roleDoc = null;
      if (/^[0-9a-fA-F]{24}$/.test(user.role)) {
        roleDoc = await Role.findById(user.role);
      } else {
        const sName = user.role.toLowerCase();
        if (sName.includes("admin")) roleDoc = await Role.findOne({ name: "Admin" });
        else if (sName.includes("manager")) roleDoc = await Role.findOne({ name: "Manager" });
        else if (sName.includes("sale")) roleDoc = await Role.findOne({ name: "Sales Staff" });
        else if (sName.includes("account")) roleDoc = await Role.findOne({ name: "Accounts Staff" });
        else if (sName.includes("purchase")) roleDoc = await Role.findOne({ name: "Purchase Staff" });
        else if (sName.includes("store")) roleDoc = await Role.findOne({ name: "Store Staff" });
        else roleDoc = await Role.findOne({ name: new RegExp(`^${user.role}$`, "i") });
      }

      if (!roleDoc) {
        roleDoc = await Role.findOne({ isSystemRole: true });
      }

      if (roleDoc) {
        user.role = roleDoc._id;
        await user.save();
        user.role = roleDoc;
      }
    } else {
      await user.populate("role");
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: formatAuthPayload(user, token),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user profile & effective permissions
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    let user = await User.findById(req.user._id);
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (user.role && typeof user.role === "string") {
      let roleDoc = null;
      if (/^[0-9a-fA-F]{24}$/.test(user.role)) {
        roleDoc = await Role.findById(user.role);
      } else {
        const sName = user.role.toLowerCase();
        if (sName.includes("admin")) roleDoc = await Role.findOne({ name: "Admin" });
        else if (sName.includes("manager")) roleDoc = await Role.findOne({ name: "Manager" });
        else if (sName.includes("sale")) roleDoc = await Role.findOne({ name: "Sales Staff" });
        else if (sName.includes("account")) roleDoc = await Role.findOne({ name: "Accounts Staff" });
        else if (sName.includes("purchase")) roleDoc = await Role.findOne({ name: "Purchase Staff" });
        else if (sName.includes("store")) roleDoc = await Role.findOne({ name: "Store Staff" });
        else roleDoc = await Role.findOne({ name: new RegExp(`^${user.role}$`, "i") });
      }

      if (!roleDoc) {
        roleDoc = await Role.findOne({ isSystemRole: true });
      }

      if (roleDoc) {
        user.role = roleDoc._id;
        await user.save();
        user.role = roleDoc;
      }
    } else {
      await user.populate("role");
    }

    res.status(200).json({
      success: true,
      data: formatAuthPayload(user),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get system permissions metadata
// @route   GET /api/auth/permissions
// @access  Private
export const getPermissionsMetadata = async (req, res, next) => {
  try {
    const userPermissions = getEffectivePermissions(req.user);
    res.status(200).json({
      success: true,
      data: {
        userPermissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public / Private
export const logoutUser = async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
};

// @desc    Get all users (with role populated)
// @route   GET /api/auth/users
// @access  Private
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().populate("role").sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user by ID
// @route   GET /api/auth/users/:id
// @access  Private
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate("role");
    if (!user) {
      return next(new AppError("User not found", 404));
    }
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new user
// @route   POST /api/auth/users
// @access  Private
export const createUser = async (req, res, next) => {
  try {
    const { name, email, phone, password, role, permissionOverrides, status } = req.body;
    if (!name || !email || !password) {
      return next(new AppError("Please provide name, email and password", 400));
    }
    const emailLower = email.toLowerCase().trim();
    const existing = await User.findOne({ email: emailLower });
    if (existing) {
      return next(new AppError("User with this email already exists", 400));
    }

    const user = await User.create({
      name: name.trim(),
      email: emailLower,
      phone: phone ? phone.trim() : "",
      password,
      role: role || "Sales Staff",
      permissionOverrides: permissionOverrides || [],
      status: status || "active",
      createdBy: req.user._id,
    });

    const populated = await User.findById(user._id).populate("role");

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/auth/users/:id
// @access  Private
export const updateUser = async (req, res, next) => {
  try {
    const { name, email, phone, role, permissionOverrides, status, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (name) user.name = name.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (role !== undefined) user.role = role;
    if (permissionOverrides !== undefined) user.permissionOverrides = permissionOverrides;
    if (status !== undefined) user.status = status;
    if (password) user.password = password;
    user.updatedBy = req.user._id;

    await user.save();

    const populated = await User.findById(user._id).populate("role");

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/auth/users/:id
// @access  Private
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (String(user._id) === String(req.user._id)) {
      return next(new AppError("You cannot delete your own account", 400));
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
