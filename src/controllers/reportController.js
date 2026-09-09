import Customer from "../models/Customer.js";
import Expense from "../models/Expense.js";
import Product from "../models/Product.js";
import PurchaseDocument from "../models/PurchaseDocument.js";
import SaleDocument from "../models/SaleDocument.js";
import Supplier from "../models/Supplier.js";

function buildDateQuery(startDate, endDate) {
  const df = {};
  if (startDate) { const s = new Date(startDate); s.setHours(0,0,0,0); df.$gte = s; }
  if (endDate)   { const e = new Date(endDate);   e.setHours(23,59,59,999); df.$lte = e; }
  return df;
}

// GET /api/reports/sales
export const getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate, status, customerId, documentType, search } = req.query;
    const query = {};
    const df = buildDateQuery(startDate, endDate);
    if (df.$gte || df.$lte) query.createdAt = df;
    if (status && status !== "all") query.paymentStatus = status.toLowerCase();
    if (customerId && customerId !== "all") query.customer = customerId;
    if (documentType && documentType !== "all") query.documentType = documentType;
    if (search) query.$or = [
      { documentNumber: { $regex: search, $options: "i" } },
      { customerName:   { $regex: search, $options: "i" } },
    ];

    const docs = await SaleDocument.find(query).sort({ createdAt: -1 });
    const totalAmount   = docs.reduce((a, d) => a + (d.grandTotal  || 0), 0);
    const totalReceived = docs.reduce((a, d) => a + (d.amountPaid  || 0), 0);
    const totalBalance  = docs.reduce((a, d) => a + (d.balanceDue  || 0), 0);

    const customers = await Customer.find().select("_id name");

    res.json({ success: true, data: {
      records: docs,
      customers,
      metrics: {
        totalCount: docs.length,
        totalAmount:   Math.round(totalAmount   * 100) / 100,
        totalReceived: Math.round(totalReceived * 100) / 100,
        totalBalance:  Math.round(totalBalance  * 100) / 100,
      },
    }});
  } catch (e) { next(e); }
};

// GET /api/reports/purchases
export const getPurchaseReport = async (req, res, next) => {
  try {
    const { startDate, endDate, status, supplierId, documentType, search } = req.query;
    const query = {};
    const df = buildDateQuery(startDate, endDate);
    if (df.$gte || df.$lte) query.createdAt = df;
    if (status && status !== "all") query.paymentStatus = status.toLowerCase();
    if (supplierId && supplierId !== "all") query.supplier = supplierId;
    if (documentType && documentType !== "all") query.documentType = documentType;
    if (search) query.$or = [
      { documentNumber: { $regex: search, $options: "i" } },
      { supplierName:   { $regex: search, $options: "i" } },
    ];

    const docs = await PurchaseDocument.find(query).sort({ createdAt: -1 });
    const totalAmount  = docs.reduce((a, d) => a + (d.grandTotal || 0), 0);
    const totalPaid    = docs.reduce((a, d) => a + (d.amountPaid || 0), 0);
    const totalPayable = docs.reduce((a, d) => a + (d.balanceDue || 0), 0);

    const suppliers = await Supplier.find().select("_id name");

    res.json({ success: true, data: {
      records: docs,
      suppliers,
      metrics: {
        totalCount: docs.length,
        totalAmount:  Math.round(totalAmount  * 100) / 100,
        totalPaid:    Math.round(totalPaid    * 100) / 100,
        totalPayable: Math.round(totalPayable * 100) / 100,
      },
    }});
  } catch (e) { next(e); }
};

// GET /api/reports/inventory
export const getInventoryReport = async (req, res, next) => {
  try {
    const { category, status, search } = req.query;
    const query = {};
    if (category && category !== "all") query.category = category;
    if (status   && status   !== "all") query.status   = status;
    if (search) query.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku:  { $regex: search, $options: "i" } },
    ];

    const products = await Product.find(query).sort({ name: 1 });
    const totalStockValue = products.reduce((a, p) => a + ((p.stockQuantity || 0) * (p.costPrice || 0)), 0);
    const lowStockCount   = products.filter(p => (p.stockQuantity || 0) <= (p.minStockAlert || 5)).length;
    const categories      = [...new Set(products.map(p => p.category).filter(Boolean))];

    res.json({ success: true, data: {
      records: products,
      categories,
      metrics: {
        totalItems:     products.length,
        totalStockQty:  products.reduce((a, p) => a + (p.stockQuantity || 0), 0),
        totalStockValue: Math.round(totalStockValue * 100) / 100,
        lowStockCount,
      },
    }});
  } catch (e) { next(e); }
};

// GET /api/reports/expenses
export const getExpenseReport = async (req, res, next) => {
  try {
    const { startDate, endDate, category, paymentMethod, status, search } = req.query;
    const query = {};
    const df = buildDateQuery(startDate, endDate);
    if (df.$gte || df.$lte) query.expenseDate = df;
    if (category && category !== "all")         query.category      = category;
    if (paymentMethod && paymentMethod !== "all") query.paymentMethod = paymentMethod;
    if (status && status !== "all")             query.status        = status;
    if (search) query.$or = [
      { title:         { $regex: search, $options: "i" } },
      { expenseNumber: { $regex: search, $options: "i" } },
    ];

    const expenses = await Expense.find(query).sort({ expenseDate: -1 });
    const totalAmount = expenses.reduce((a, e) => a + (e.amount || 0), 0);

    const byCategory = {};
    expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });

    res.json({ success: true, data: {
      records: expenses,
      metrics: {
        totalCount:  expenses.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        byCategory,
      },
    }});
  } catch (e) { next(e); }
};

// GET /api/reports/profit-loss
export const getProfitLossReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};
    const df = buildDateQuery(startDate, endDate);
    if (df.$gte || df.$lte) query.createdAt = df;

    const expQuery = {};
    const dfExp = buildDateQuery(startDate, endDate);
    if (dfExp.$gte || dfExp.$lte) expQuery.expenseDate = dfExp;

    const [salesDocs, purchaseDocs, expenses] = await Promise.all([
      SaleDocument.find({ ...query, documentType: "invoice" }),
      PurchaseDocument.find(query),
      Expense.find(expQuery),
    ]);

    const totalRevenue   = salesDocs.reduce((a, s) => a + (s.grandTotal || 0), 0);
    const totalPurchases = purchaseDocs.reduce((a, p) => a + (p.grandTotal || 0), 0);
    const totalExpenses  = expenses.reduce((a, e) => a + (e.amount || 0), 0);
    const grossProfit    = totalRevenue - totalPurchases;
    const netProfit      = grossProfit - totalExpenses;

    res.json({ success: true, data: {
      metrics: {
        totalRevenue:   Math.round(totalRevenue   * 100) / 100,
        totalPurchases: Math.round(totalPurchases * 100) / 100,
        totalExpenses:  Math.round(totalExpenses  * 100) / 100,
        grossProfit:    Math.round(grossProfit    * 100) / 100,
        netProfit:      Math.round(netProfit      * 100) / 100,
      },
      revenueBreakdown: salesDocs.map(s => ({
        documentNumber: s.documentNumber, partyName: s.customerName,
        date: s.createdAt, amount: s.grandTotal, type: "Income",
      })),
      expenseBreakdown: purchaseDocs.map(p => ({
        documentNumber: p.documentNumber, partyName: p.supplierName,
        date: p.createdAt, amount: p.grandTotal, type: "Purchase Cost",
      })),
      otherExpenses: expenses.map(e => ({
        documentNumber: e.expenseNumber, partyName: e.category,
        date: e.expenseDate, amount: e.amount, type: "Expense",
      })),
    }});
  } catch (e) { next(e); }
};

// GET /api/reports/customer-ledger
export const getCustomerLedgerReport = async (req, res, next) => {
  try {
    const { customerId, startDate, endDate } = req.query;
    const customers = await Customer.find().select("_id name company balance");
    let targetId = customerId;
    if (!targetId || targetId === "all") {
      if (!customers.length) return res.json({ success: true, data: { customer: null, customers, records: [], metrics: {} } });
      targetId = customers[0]._id;
    }
    const customerDoc = await Customer.findById(targetId);
    if (!customerDoc) return res.status(404).json({ success: false, message: "Customer not found" });

    const query = { customer: targetId };
    const df = buildDateQuery(startDate, endDate);
    if (df.$gte || df.$lte) query.createdAt = df;

    const sales = await SaleDocument.find(query).sort({ createdAt: 1 });
    let running = 0;
    const ledger = sales.map(s => {
      running += s.balanceDue || 0;
      return { _id: s._id, date: s.createdAt, documentNumber: s.documentNumber,
        documentType: s.documentType, totalAmount: s.grandTotal,
        amountPaid: s.amountPaid, balanceDue: s.balanceDue,
        status: s.paymentStatus, runningBalance: Math.round(running * 100) / 100 };
    });

    res.json({ success: true, data: {
      customer: customerDoc, customers,
      records: ledger,
      metrics: {
        totalBilled:    Math.round(sales.reduce((a, s) => a + (s.grandTotal || 0), 0) * 100) / 100,
        totalPaid:      Math.round(sales.reduce((a, s) => a + (s.amountPaid || 0), 0) * 100) / 100,
        currentBalance: Math.round((customerDoc.balance || 0) * 100) / 100,
      },
    }});
  } catch (e) { next(e); }
};

// GET /api/reports/supplier-ledger
export const getSupplierLedgerReport = async (req, res, next) => {
  try {
    const { supplierId, startDate, endDate } = req.query;
    const suppliers = await Supplier.find().select("_id name company payableBalance");
    let targetId = supplierId;
    if (!targetId || targetId === "all") {
      if (!suppliers.length) return res.json({ success: true, data: { supplier: null, suppliers, records: [], metrics: {} } });
      targetId = suppliers[0]._id;
    }
    const supplierDoc = await Supplier.findById(targetId);
    if (!supplierDoc) return res.status(404).json({ success: false, message: "Supplier not found" });

    const query = { supplier: targetId };
    const df = buildDateQuery(startDate, endDate);
    if (df.$gte || df.$lte) query.createdAt = df;

    const purchases = await PurchaseDocument.find(query).sort({ createdAt: 1 });
    let running = 0;
    const ledger = purchases.map(p => {
      running += p.balanceDue || 0;
      return { _id: p._id, date: p.createdAt, documentNumber: p.documentNumber,
        documentType: p.documentType, totalAmount: p.grandTotal,
        amountPaid: p.amountPaid, balanceDue: p.balanceDue,
        status: p.paymentStatus, runningBalance: Math.round(running * 100) / 100 };
    });

    res.json({ success: true, data: {
      supplier: supplierDoc, suppliers,
      records: ledger,
      metrics: {
        totalPurchased:  Math.round(purchases.reduce((a, p) => a + (p.grandTotal || 0), 0) * 100) / 100,
        totalPaid:       Math.round(purchases.reduce((a, p) => a + (p.amountPaid || 0), 0) * 100) / 100,
        currentPayable:  Math.round((supplierDoc.payableBalance || 0) * 100) / 100,
      },
    }});
  } catch (e) { next(e); }
};
