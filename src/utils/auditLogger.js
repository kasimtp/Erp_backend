import AuditLog from "../models/AuditLog.js";

export async function createAuditLog({ req, action, targetType, targetId, previousData, newData }) {
  try {
    const performedBy = req?.user?._id || req?.user?.id;
    if (!performedBy) return;

    const ipAddress = req?.ip || req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress || "";

    await AuditLog.create({
      performedBy,
      action,
      targetType,
      targetId,
      previousData: previousData || null,
      newData: newData || null,
      ipAddress: String(ipAddress),
    });
  } catch (err) {
    console.error("AuditLog creation error:", err.message);
  }
}
