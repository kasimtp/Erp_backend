import mongoose from "mongoose";

const stockAdjustmentSchema = new mongoose.Schema(
  {
    adjustmentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      default: "",
    },
    adjustmentType: {
      type: String,
      enum: ["increase", "decrease"],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    previousStock: {
      type: Number,
      default: 0,
    },
    newStock: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String,
      required: true,
      default: "Audit Count Correction",
    },
    notes: {
      type: String,
      default: "",
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

const StockAdjustment = mongoose.model("StockAdjustment", stockAdjustmentSchema);

export default StockAdjustment;
