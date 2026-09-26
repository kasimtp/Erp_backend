import Customer from "../models/Customer.js";
import Product from "../models/Product.js";
import SaleDocument from "../models/SaleDocument.js";
import User from "../models/User.js";

export async function seedSalesData() {
  try {
    const adminUser = await User.findOne({ email: "admin@example.com" }) || await User.findOne();
    if (!adminUser) return;

    // 1. Seed Products if empty
    let prodCount = await Product.countDocuments();
    if (prodCount === 0) {
      await Product.create([
        {
          sku: "PRD-1001",
          name: "Enterprise ERP Software License",
          category: "Software",
          description: "Annual recurring license for CRM ERP Enterprise Suite",
          costPrice: 450.0,
          sellingPrice: 1200.0,
          stockQuantity: 50,
          minStockAlert: 5,
          unit: "license",
          status: "in stock",
          createdBy: adminUser._id,
        },
        {
          sku: "PRD-1002",
          name: "Cloud Server Hosting (Monthly)",
          category: "Infrastructure",
          description: "Dedicated cloud instance hosting with high availability SLA",
          costPrice: 80.0,
          sellingPrice: 250.0,
          stockQuantity: 100,
          minStockAlert: 10,
          unit: "month",
          status: "in stock",
          createdBy: adminUser._id,
        },
        {
          sku: "PRD-1003",
          name: "On-site Implementation & Training",
          category: "Services",
          description: "Full-day expert implementation and user training session",
          costPrice: 300.0,
          sellingPrice: 850.0,
          stockQuantity: 20,
          minStockAlert: 2,
          unit: "service",
          status: "in stock",
          createdBy: adminUser._id,
        },
        {
          sku: "PRD-1004",
          name: "POS Hardware Terminal Pack",
          category: "Hardware",
          description: "Barcode scanner, thermal receipt printer & touch display",
          costPrice: 220.0,
          sellingPrice: 480.0,
          stockQuantity: 12,
          minStockAlert: 3,
          unit: "set",
          status: "in stock",
          createdBy: adminUser._id,
        },
      ]);
      console.log("Default product catalog seeded.");
    }

    // 2. Seed Customers if empty
    let custCount = await Customer.countDocuments();
    if (custCount === 0) {
      await Customer.create([
        {
          name: "Apex Trading Global",
          email: "procurement@apextrading.com",
          phone: "+91 98980 11223",
          company: "Apex Group",
          address: "702 Trade Tower, Business Bay, Mumbai",
          taxId: "GST27APEX1234F1Z5",
          creditLimit: 50000,
          balance: 0,
          createdBy: adminUser._id,
        },
        {
          name: "Metro Retail Solutions",
          email: "accounts@metroretail.in",
          phone: "+91 97766 44332",
          company: "Metro Retail Ltd",
          address: "45 MG Road, Indiranagar, Bengaluru",
          taxId: "GST29METRO5678K1Z9",
          creditLimit: 25000,
          balance: 0,
          createdBy: adminUser._id,
        },
        {
          name: "Zenith Logistics Co.",
          email: "info@zenithlogistics.org",
          phone: "+91 95544 33221",
          company: "Zenith Group",
          address: "12 Logistics Hub, Port Road, Kochi",
          taxId: "GST32ZENITH9012L1Z2",
          creditLimit: 15000,
          balance: 0,
          createdBy: adminUser._id,
        },
      ]);
      console.log("Default customer directory seeded.");
    }

    // 3. Seed Sample Invoice if empty
    let salesCount = await SaleDocument.countDocuments();
    if (salesCount === 0) {
      const cust = await Customer.findOne();
      const prd = await Product.findOne();

      if (cust && prd) {
        const itemSubtotal = 1 * prd.sellingPrice;
        const grandTotal = itemSubtotal;

        const inv = await SaleDocument.create({
          documentType: "invoice",
          documentNumber: "INV-1001",
          customer: cust._id,
          customerName: cust.name,
          items: [
            {
              product: prd._id,
              productName: prd.name,
              sku: prd.sku,
              quantity: 1,
              unitPrice: prd.sellingPrice,
              taxRate: 0,
              discountRate: 0,
              total: grandTotal,
            },
          ],
          subtotal: itemSubtotal,
          taxTotal: 0,
          discountTotal: 0,
          grandTotal: grandTotal,
          amountPaid: 0,
          balanceDue: grandTotal,
          paymentStatus: "unpaid",
          status: "sent",
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          notes: "Thank you for choosing CRM Business Suite!",
          createdBy: adminUser._id,
        });

        cust.balance = grandTotal;
        await cust.save();
        console.log("Initial sample sales invoice seeded:", inv.documentNumber);
      }
    }
  } catch (err) {
    console.error("Error seeding sales data:", err.message);
  }
}
