export const ALL_MODULES = [
  "dashboard",
  "customers",
  "suppliers",
  "products",
  "sales",
  "quotations",
  "salesOrders",
  "invoices",
  "salesReturns",
  "purchases",
  "purchaseOrders",
  "purchaseBills",
  "purchaseReturns",
  "inventory",
  "stockAdjustments",
  "expenses",
  "accounting",
  "payments",
  "reports",
  "users",
  "roles",
  "settings",
  "auditLogs",
];

export const STANDARD_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "export",
];

export const SPECIAL_ACTIONS = [
  "recordPayment",
  "reversePayment",
  "viewCostPrice",
  "viewSellingPrice",
  "viewProfit",
  "manageStock",
  "adjustStock",
  "manageUsers",
  "manageRoles",
  "manageSettings",
  "viewAuditLogs",
];

export const ALL_ACTIONS = [...STANDARD_ACTIONS, ...SPECIAL_ACTIONS];

export const MODULE_SPECIAL_ACTIONS = {
  sales: ["viewSellingPrice", "viewProfit"],
  purchases: ["viewCostPrice"],
  products: ["viewCostPrice", "viewSellingPrice"],
  inventory: ["manageStock", "adjustStock", "viewCostPrice"],
  stockAdjustments: ["manageStock", "adjustStock"],
  payments: ["recordPayment", "reversePayment"],
  accounting: ["viewProfit", "recordPayment", "reversePayment"],
  users: ["manageUsers"],
  roles: ["manageRoles"],
  settings: ["manageSettings"],
  auditLogs: ["viewAuditLogs"],
};

export function getEffectivePermissions(user) {
  if (!user) return {};

  const effectiveMap = {};

  const roleObj = user.role;
  const roleName = typeof roleObj === "object" && roleObj !== null ? roleObj.name : String(roleObj || "");
  const isAdminRole = roleName.toLowerCase() === "admin";

  if (isAdminRole) {
    ALL_MODULES.forEach((mod) => {
      let modActions = [...STANDARD_ACTIONS];
      if (MODULE_SPECIAL_ACTIONS[mod]) {
        modActions = [...modActions, ...MODULE_SPECIAL_ACTIONS[mod]];
      }
      effectiveMap[mod] = Array.from(new Set(modActions));
    });
    return effectiveMap;
  }

  if (roleObj && typeof roleObj === "object" && Array.isArray(roleObj.permissions)) {
    roleObj.permissions.forEach((permItem) => {
      if (permItem && permItem.module && Array.isArray(permItem.actions)) {
        effectiveMap[permItem.module] = [...permItem.actions];
      }
    });
  }

  if (Array.isArray(user.permissionOverrides)) {
    user.permissionOverrides.forEach((override) => {
      const mod = override.module;
      if (!mod) return;

      if (!effectiveMap[mod]) {
        effectiveMap[mod] = [];
      }

      const currentSet = new Set(effectiveMap[mod]);

      if (Array.isArray(override.allow)) {
        override.allow.forEach((act) => currentSet.add(act));
      }

      if (Array.isArray(override.deny)) {
        override.deny.forEach((act) => currentSet.delete(act));
      }

      effectiveMap[mod] = Array.from(currentSet);
    });
  }

  return effectiveMap;
}
