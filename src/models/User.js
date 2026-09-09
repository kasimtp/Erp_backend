import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { ALL_MODULES, SPECIAL_ACTIONS, STANDARD_ACTIONS } from "../utils/permissionUtils.js";
import Role from "./Role.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must contain at least eight characters"],
      select: false,
    },
    role: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Role",
    },
    permissionOverrides: [
      {
        module: {
          type: String,
          required: true,
        },
        allow: [{ type: String }],
        deny: [{ type: String }],
      },
    ],
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    lastLoginAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook to convert string roles ("admin", "manager", "staff", etc.) to valid Role ObjectIds
userSchema.pre("validate", async function (next) {
  try {
    if (this.role && typeof this.role === "string") {
      // If string is already a 24-character hexadecimal ObjectId
      if (/^[0-9a-fA-F]{24}$/.test(this.role)) {
        this.role = new mongoose.Types.ObjectId(this.role);
      } else {
        // String is a role name e.g. "admin", "manager", "staff", "sales", etc.
        const searchRoleName = this.role.toLowerCase();
        let roleDoc = null;

        if (searchRoleName.includes("admin")) {
          roleDoc = await Role.findOne({ name: "Admin" });
        } else if (searchRoleName.includes("manager")) {
          roleDoc = await Role.findOne({ name: "Manager" });
        } else if (searchRoleName.includes("sale")) {
          roleDoc = await Role.findOne({ name: "Sales Staff" });
        } else if (searchRoleName.includes("account")) {
          roleDoc = await Role.findOne({ name: "Accounts Staff" });
        } else if (searchRoleName.includes("purchase")) {
          roleDoc = await Role.findOne({ name: "Purchase Staff" });
        } else if (searchRoleName.includes("store")) {
          roleDoc = await Role.findOne({ name: "Store Staff" });
        } else {
          roleDoc = await Role.findOne({ name: new RegExp(`^${this.role}$`, "i") });
        }

        if (roleDoc) {
          this.role = roleDoc._id;
        } else {
          // Fallback to any active system role or create Admin role on the fly
          let fallbackRole = await Role.findOne({ isSystemRole: true });
          if (!fallbackRole) {
            fallbackRole = await Role.create({
              name: "Admin",
              description: "Full system administration and control over all ERP modules",
              isSystemRole: true,
              permissions: ALL_MODULES.map((mod) => ({
                module: mod,
                actions: [...STANDARD_ACTIONS, ...SPECIAL_ACTIONS],
              })),
            });
          }
          if (fallbackRole) {
            this.role = fallbackRole._id;
          }
        }
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Helper method to get safe user data
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    permissionOverrides: this.permissionOverrides,
    status: this.status,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const User = mongoose.model("User", userSchema);

export default User;
