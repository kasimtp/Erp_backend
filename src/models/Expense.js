import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    expenseNumber: { type: String, unique: true },
    title: { type: String, required: [true, "Expense title is required"], trim: true },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: ["Rent", "Salaries", "Utilities", "Transport", "Software", "Marketing", "Office Supplies", "Repairs", "Insurance", "Meals", "Travel", "Other"],
      default: "Other",
    },
    amount: { type: Number, required: [true, "Amount is required"], min: 0 },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Bank Transfer", "Card", "UPI", "Cheque", "Other"],
      default: "Cash",
    },
    expenseDate: { type: Date, required: true, default: Date.now },
    reference: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: { type: String, enum: ["paid", "pending", "cancelled"], default: "paid" },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Auto-generate expense number
expenseSchema.pre("save", async function (next) {
  if (!this.expenseNumber) {
    const count = await mongoose.model("Expense").countDocuments();
    this.expenseNumber = `EXP-${String(count + 1001).padStart(4, "0")}`;
  }
  next();
});

const Expense = mongoose.model("Expense", expenseSchema);
export default Expense;
