import Role from "../models/Role.js";
import User from "../models/User.js";
import { ALL_MODULES, SPECIAL_ACTIONS, STANDARD_ACTIONS } from "./permissionUtils.js";

export async function seedRolesAndUsers() {
  try {
    const adminPermissions = ALL_MODULES.map((mod) => ({
      module: mod,
      actions: [...STANDARD_ACTIONS, ...SPECIAL_ACTIONS],
    }));

    const managerModules = [
      "dashboard", "customers", "suppliers", "products", "sales", "quotations",
      "salesOrders", "invoices", "salesReturns", "purchases", "purchaseOrders",
      "purchaseBills", "purchaseReturns", "inventory", "stockAdjustments",
      "expenses", "accounting", "payments", "reports"
    ];
    const managerPermissions = managerModules.map((mod) => ({
      module: mod,
      actions: ["view", "export"],
    }));

    const salesPermissions = [
      { module: "dashboard", actions: ["view"] },
      { module: "customers", actions: ["view", "create", "edit"] },
      { module: "products", actions: ["view", "viewSellingPrice"] },
      { module: "quotations", actions: ["view", "create", "edit"] },
      { module: "salesOrders", actions: ["view", "create"] },
      { module: "invoices", actions: ["view", "create"] },
      { module: "sales", actions: ["view", "create", "edit", "viewSellingPrice"] },
      { module: "payments", actions: ["view"] },
    ];

    const accountsPermissions = [
      { module: "dashboard", actions: ["view"] },
      { module: "customers", actions: ["view"] },
      { module: "suppliers", actions: ["view"] },
      { module: "sales", actions: ["view"] },
      { module: "purchases", actions: ["view"] },
      { module: "invoices", actions: ["view"] },
      { module: "purchaseBills", actions: ["view"] },
      { module: "payments", actions: ["view", "create", "recordPayment"] },
      { module: "expenses", actions: ["view", "create", "edit", "export"] },
      { module: "accounting", actions: ["view", "export", "viewProfit"] },
      { module: "reports", actions: ["view", "export"] },
    ];

    const purchasePermissions = [
      { module: "suppliers", actions: ["view", "create", "edit"] },
      { module: "products", actions: ["view", "viewCostPrice"] },
      { module: "purchases", actions: ["view", "create", "edit", "viewCostPrice"] },
      { module: "purchaseOrders", actions: ["view", "create", "edit"] },
      { module: "purchaseBills", actions: ["view", "create", "edit"] },
      { module: "purchaseReturns", actions: ["view", "create"] },
      { module: "payments", actions: ["view"] },
      { module: "inventory", actions: ["view"] },
    ];

    const storePermissions = [
      { module: "products", actions: ["view"] },
      { module: "inventory", actions: ["view", "manageStock", "adjustStock"] },
      { module: "stockAdjustments", actions: ["view", "create", "adjustStock"] },
    ];

    const rolesConfig = [
      { name: "Admin", description: "Full system administration and control over all ERP modules", permissions: adminPermissions, isSystemRole: true },
      { name: "Manager", description: "Business manager with view and export access across operational modules", permissions: managerPermissions, isSystemRole: true },
      { name: "Sales Staff", description: "Sales team creating quotations, orders, invoices and managing customers", permissions: salesPermissions, isSystemRole: true },
      { name: "Accounts Staff", description: "Finance team recording payments, managing expenses and financial reports", permissions: accountsPermissions, isSystemRole: true },
      { name: "Purchase Staff", description: "Procurement team managing suppliers, purchase orders and supplier bills", permissions: purchasePermissions, isSystemRole: true },
      { name: "Store Staff", description: "Inventory team managing stock levels, stock-in/out and adjustments", permissions: storePermissions, isSystemRole: true },
    ];

    const seededRoleDocs = {};

    for (const rCfg of rolesConfig) {
      let roleDoc = await Role.findOne({ name: rCfg.name });
      if (!roleDoc) {
        roleDoc = await Role.create(rCfg);
      } else {
        roleDoc.isSystemRole = true;
        if (!roleDoc.permissions || roleDoc.permissions.length === 0) {
          roleDoc.permissions = rCfg.permissions;
        }
        await roleDoc.save();
      }
      seededRoleDocs[rCfg.name] = roleDoc._id;
    }

    const seedPassword = process.env.SEED_USER_PASSWORD || "Password123!";

    const defaultUsers = [
      { name: "System Admin", email: "admin@example.com", phone: "+91 98765 00001", roleName: "Admin" },
      { name: "Business Manager", email: "manager@example.com", phone: "+91 98765 00002", roleName: "Manager" },
      { name: "Nisha Sales", email: "sales@example.com", phone: "+91 98765 00003", roleName: "Sales Staff" },
      { name: "Safa Accountant", email: "accounts@example.com", phone: "+91 98765 00004", roleName: "Accounts Staff" },
      { name: "Anoob Purchase", email: "purchase@example.com", phone: "+91 98765 00005", roleName: "Purchase Staff" },
      { name: "Rahul Storekeeper", email: "store@example.com", phone: "+91 98765 00006", roleName: "Store Staff" },
    ];

    for (const uCfg of defaultUsers) {
      let userDoc = await User.findOne({ email: uCfg.email.toLowerCase() });
      const roleId = seededRoleDocs[uCfg.roleName];

      if (!userDoc) {
        await User.create({
          name: uCfg.name,
          email: uCfg.email.toLowerCase(),
          phone: uCfg.phone,
          password: seedPassword,
          role: roleId,
          status: "active",
        });
      } else {
        if (!userDoc.role || typeof userDoc.role === "string") {
          userDoc.role = roleId;
          await userDoc.save();
        }
      }
    }

    // Migrate ALL existing user documents in MongoDB whose role is stored as a string or role name (e.g. "admin", "manager")
    const allUsers = await User.find();
    for (const u of allUsers) {
      if (u.role && typeof u.role === "string") {
        let matchId = null;
        if (/^[0-9a-fA-F]{24}$/.test(u.role)) {
          matchId = new mongoose.Types.ObjectId(u.role);
        } else {
          const sName = u.role.toLowerCase();
          if (sName.includes("admin")) matchId = seededRoleDocs["Admin"];
          else if (sName.includes("manager")) matchId = seededRoleDocs["Manager"];
          else if (sName.includes("sale")) matchId = seededRoleDocs["Sales Staff"];
          else if (sName.includes("account")) matchId = seededRoleDocs["Accounts Staff"];
          else if (sName.includes("purchase")) matchId = seededRoleDocs["Purchase Staff"];
          else if (sName.includes("store")) matchId = seededRoleDocs["Store Staff"];
          else matchId = seededRoleDocs["Admin"] || seededRoleDocs["Sales Staff"];
        }

        if (matchId) {
          u.role = matchId;
          await u.save();
          console.log(`Migrated user ${u.email} role from string to ObjectId(${matchId})`);
        }
      }
    }

    console.log("Roles and default users check/seed/migration completed successfully.");
  } catch (err) {
    console.error("Error seeding roles and users:", err.message);
  }
}
