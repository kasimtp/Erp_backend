import Customer from "../models/Customer.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import PurchaseDocument from "../models/PurchaseDocument.js";
import SaleDocument from "../models/SaleDocument.js";
import StockAdjustment from "../models/StockAdjustment.js";
import Supplier from "../models/Supplier.js";

// @desc    Get dashboard summary, live metrics, chart data & recent activity
// @route   GET /api/dashboard/summary
// @access  Private
export const getDashboardSummary = async (req, res, next) => {
  try {
    const salesDocs = await SaleDocument.find({ documentType: "invoice" });
    const purchaseDocs = await PurchaseDocument.find();
    const customersCount = await Customer.countDocuments();
    const suppliersCount = await Supplier.countDocuments();
    const products = await Product.find();

    // 1. Calculate Financial Stats
    let totalSales = 0;
    let totalReceived = 0;
    let totalReceivables = 0;

    salesDocs.forEach((doc) => {
      totalSales += doc.grandTotal || 0;
      totalReceived += doc.amountPaid || 0;
      totalReceivables += doc.balanceDue || 0;
    });

    let totalPurchases = 0;
    let totalPayables = 0;

    purchaseDocs.forEach((doc) => {
      totalPurchases += doc.grandTotal || 0;
      totalPayables += doc.balanceDue || 0;
    });

    const netProfit = Math.max(0, totalSales - totalPurchases);

    // 2. Inventory Metrics
    let stockItemsCount = products.length;
    let lowStockCount = 0;

    products.forEach((p) => {
      if ((p.stockQuantity || 0) <= (p.minStockAlert || 5)) {
        lowStockCount++;
      }
    });

    // 3. Generate Monthly Chart Data (Last 6 Months)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const chart = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const mName = monthNames[mIdx];
      const year = d.getFullYear();

      const startOfMonth = new Date(year, mIdx, 1);
      const endOfMonth = new Date(year, mIdx + 1, 0, 23, 59, 59);

      let rev = 0;
      let exp = 0;

      salesDocs.forEach((doc) => {
        if (doc.createdAt >= startOfMonth && doc.createdAt <= endOfMonth) {
          rev += doc.grandTotal || 0;
        }
      });

      purchaseDocs.forEach((doc) => {
        if (doc.createdAt >= startOfMonth && doc.createdAt <= endOfMonth) {
          exp += doc.grandTotal || 0;
        }
      });

      chart.push({
        month: mName,
        revenue: Math.round(rev),
        expenses: Math.round(exp),
      });
    }

    // 4. Generate Recent Activity Stream
    const activities = [];

    // Recent Payments
    const recentPayments = await Payment.find().populate("customer", "name").sort({ createdAt: -1 }).limit(3);
    recentPayments.forEach((p) => {
      activities.push({
        id: `pay-${p._id}`,
        title: `Payment received from ${p.customer?.name || "Customer"}`,
        detail: `Amount: ₹${p.amount?.toLocaleString("en-IN")} • ${p.paymentNumber}`,
        createdAt: p.createdAt,
      });
    });

    // Recent Invoices
    const recentInvoices = await SaleDocument.find({ documentType: "invoice" }).sort({ createdAt: -1 }).limit(3);
    recentInvoices.forEach((inv) => {
      activities.push({
        id: `inv-${inv._id}`,
        title: `Sales invoice created ${inv.documentNumber}`,
        detail: `Customer: ${inv.customerName} • ₹${inv.grandTotal?.toLocaleString("en-IN")}`,
        createdAt: inv.createdAt,
      });
    });

    // Recent Purchases
    const recentPurchases = await PurchaseDocument.find().sort({ createdAt: -1 }).limit(3);
    recentPurchases.forEach((po) => {
      activities.push({
        id: `po-${po._id}`,
        title: `Purchase document ${po.documentNumber}`,
        detail: `Supplier: ${po.supplierName} • ₹${po.grandTotal?.toLocaleString("en-IN")}`,
        createdAt: po.createdAt,
      });
    });

    // Recent Adjustments
    const recentAdj = await StockAdjustment.find().sort({ createdAt: -1 }).limit(3);
    recentAdj.forEach((adj) => {
      activities.push({
        id: `adj-${adj._id}`,
        title: `Stock adjusted for ${adj.productName}`,
        detail: `${adj.adjustmentType === "increase" ? "+" : "-"}${adj.quantity} units • ${adj.reason}`,
        createdAt: adj.createdAt,
      });
    });

    // Sort combined activities by date descending & pick top 6
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const finalActivities = activities.slice(0, 6);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalSales: Math.round(totalSales * 100) / 100,
          totalPurchases: Math.round(totalPurchases * 100) / 100,
          totalExpenses: Math.round(totalPayables * 100) / 100,
          netProfit: Math.round(netProfit * 100) / 100,
          totalReceivables: Math.round(totalReceivables * 100) / 100,
          totalReceived: Math.round(totalReceived * 100) / 100,
        },
        summary: {
          customersCount,
          suppliersCount,
          stockItemsCount,
          lowStockCount,
        },
        chart,
        activities: finalActivities,
      },
    });
  } catch (error) {
    next(error);
  }
};
