import jwt from "jsonwebtoken";
import Role from "../models/Role.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";

export const protect = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(new AppError("Not authorized, missing or invalid token", 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user = await User.findById(decoded.id);

    if (!user) {
      return next(new AppError("Not authorized, user no longer exists", 401));
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

    if (user.status !== "active") {
      return next(new AppError("User account is inactive. Please contact admin.", 401));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new AppError("Not authorized, token failed", 401));
  }
};
