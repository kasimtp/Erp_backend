import mongoose from "mongoose";

const quotationItemSchema = new mongoose.Schema(
  {
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
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
    },
    discountRate: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
  },
  { _id: true }
);

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // Also store documentNumber for unified interface compatibility
    documentNumber: {
      type: String,
      trim: true,
    },
    documentType: {
      type: String,
      default: "quotation",
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    customerName: {
      type: String,
      default: "",
    },
    items: [quotationItemSchema],
    subtotal: {
      type: Number,
      default: 0,
    },
    taxTotal: {
      type: Number,
      default: 0,
    },
    discountTotal: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ["draft", "sent", "approved", "completed", "cancelled"],
      default: "sent",
    },
    validUntil: {
      type: Date,
    },
    // Keep dueDate alias so PDF utilities work interchangeably
    dueDate: {
      type: Date,
    },
    notes: {
      type: String,
      default: "",
    },
    terms: {
      type: String,
      default: "1. Validity: 30 days from quote date.\n2. Payment: Standard terms.\n3. Delivery: Upon confirmed purchase order.",
    },
    isConverted: {
      type: Boolean,
      default: false,
    },
    convertedInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SaleDocument",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "quotations", // explicitly save to 'quotations' collection in MongoDB
  }
);

// Pre-save hook to ensure documentNumber equals quotationNumber and dueDate equals validUntil
quotationSchema.pre("save", function (next) {
  if (!this.documentNumber) {
    this.documentNumber = this.quotationNumber;
  }
  if (!this.dueDate && this.validUntil) {
    this.dueDate = this.validUntil;
  } else if (!this.validUntil && this.dueDate) {
    this.validUntil = this.dueDate;
  }
  next();
});

const Quotation = mongoose.model("Quotation", quotationSchema);

export default Quotation;
