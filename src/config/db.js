import mongoose from "mongoose";
import { seedPurchaseData } from "../utils/seedPurchaseData.js";
import { seedRolesAndUsers } from "../utils/seedRolesAndUsers.js";
import { seedSalesData } from "../utils/seedSalesData.js";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    // Auto-seed roles, default users, sales & purchase data
    await seedRolesAndUsers();
    await seedSalesData();
    await seedPurchaseData();
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
