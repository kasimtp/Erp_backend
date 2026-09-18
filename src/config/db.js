import dns from "dns";
import mongoose from "mongoose";
import { seedPurchaseData } from "../utils/seedPurchaseData.js";
import { seedRolesAndUsers } from "../utils/seedRolesAndUsers.js";
import { seedSalesData } from "../utils/seedSalesData.js";

// Fix for Node.js SRV record lookup issue (querySrv EBADRESP)
try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (e) {
  // Ignore if custom DNS cannot be set
}

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
