import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    saleDocument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SaleDocument",
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
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
      default: "cash",
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
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
