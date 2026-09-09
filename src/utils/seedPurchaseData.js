import Product from "../models/Product.js";
import PurchaseDocument from "../models/PurchaseDocument.js";
import Supplier from "../models/Supplier.js";
import User from "../models/User.js";

export async function seedPurchaseData() {
  try {
    const adminUser = await User.findOne({ email: "admin@example.com" }) || await User.findOne();
    if (!adminUser) return;

    // 1. Seed Suppliers if empty
    let suppCount = await Supplier.countDocuments();
    if (suppCount === 0) {
      await Supplier.create([
        {
          name: "Metro Steel Works",
          company: "Metro Steel Corp",
          email: "orders@metrosteel.com",
          phone: "+91 98460 11220",
          address: "Plot 40, Industrial Area, Thane, Mumbai",
          taxId: "GST27METRO9876S1Z1",
          payableBalance: 0,
          createdBy: adminUser._id,
        },
        {
          name: "Prime Components Ltd.",
          company: "Prime Group",
          email: "sales@primecomp.in",
          phone: "+91 99471 32008",
          address: "88 Electronic City, Phase 1, Bengaluru",
          taxId: "GST29PRIME5432C1Z8",
          payableBalance: 0,
          createdBy: adminUser._id,
        },
        {
          name: "HeatPro Systems",
          company: "HeatPro Infra",
          email: "support@heatpro.org",
          phone: "+91 80752 91460",
          address: "15 Tech Park, Kalamassery, Kochi",
          taxId: "GST32HEATP1122H1Z4",
          payableBalance: 0,
          createdBy: adminUser._id,
        },
      ]);
      console.log("Default supplier directory seeded.");
    }

    // 2. Seed Sample Purchase Order if empty
    let purchaseCount = await PurchaseDocument.countDocuments();
    if (purchaseCount === 0) {
      const supp = await Supplier.findOne();
      const prd = await Product.findOne();

      if (supp && prd) {
        const itemSubtotal = 5 * prd.costPrice;
        const grandTotal = itemSubtotal;

        const po = await PurchaseDocument.create({
          documentType: "purchaseOrder",
          documentNumber: "PO-1001",
          supplier: supp._id,
          supplierName: supp.name,
          items: [
            {
              product: prd._id,
              productName: prd.name,
              sku: prd.sku,
              quantity: 5,
              unitCost: prd.costPrice,
              taxRate: 0,
              total: grandTotal,
            },
          ],
          subtotal: itemSubtotal,
          taxTotal: 0,
          grandTotal: grandTotal,
          amountPaid: 0,
          balanceDue: grandTotal,
          paymentStatus: "unpaid",
          status: "received",
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          notes: "Initial inventory restock order",
          createdBy: adminUser._id,
        });

        supp.payableBalance = grandTotal;
        await supp.save();

        // Increment product stock
        prd.stockQuantity = (prd.stockQuantity || 0) + 5;
        await prd.save();

        console.log("Initial sample purchase order seeded:", po.documentNumber);
      }
    }
  } catch (err) {
    console.error("Error seeding purchase data:", err.message);
  }
}
