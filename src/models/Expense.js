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

expenseSchema.pre("save", async function (next) {
  if (!this.expenseNumber) {
    const latest = await mongoose.model("Expense").findOne({
      expenseNumber: /^EXP-[0-9]+$/
    }).sort({ expenseNumber: -1 });

    let nextSeq = 1001;
    if (latest && latest.expenseNumber) {
      const parts = latest.expenseNumber.split("-");
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) {
        nextSeq = num + 1;
      }
    }

    let expenseNumber = `EXP-${String(nextSeq).padStart(4, "0")}`;
    while (await mongoose.model("Expense").exists({ expenseNumber })) {
      nextSeq++;
      expenseNumber = `EXP-${String(nextSeq).padStart(4, "0")}`;
    }
    this.expenseNumber = expenseNumber;
  }
  next();
});

const Expense = mongoose.model("Expense", expenseSchema);
export default Expense;
