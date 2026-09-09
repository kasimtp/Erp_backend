import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: [true, "Product SKU is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: "General",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    costPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    stockQuantity: {
      type: Number,
      default: 0,
    },
    minStockAlert: {
      type: Number,
      default: 5,
    },
    unit: {
      type: String,
      default: "pcs",
    },
    status: {
      type: String,
      enum: ["in stock", "low stock", "out of stock", "discontinued"],
      default: "in stock",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

productSchema.pre("save", function (next) {
  if (this.stockQuantity <= 0) {
    this.status = "out of stock";
  } else if (this.stockQuantity <= this.minStockAlert) {
    this.status = "low stock";
  } else {
    this.status = "in stock";
  }
  next();
});

const Product = mongoose.model("Product", productSchema);

export default Product;
