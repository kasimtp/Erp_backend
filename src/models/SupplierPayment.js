import mongoose from "mongoose";

const supplierPaymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    purchaseDocument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseDocument",
      required: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Payment amount must be greater than zero"],
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bankTransfer", "creditCard", "cheque", "other"],
      default: "bankTransfer",
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    referenceNumber: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const SupplierPayment = mongoose.model("SupplierPayment", supplierPaymentSchema);

export default SupplierPayment;
