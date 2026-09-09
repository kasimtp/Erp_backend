import AuditLog from "../models/AuditLog.js";

// @desc    Get audit logs list
// @route   GET /api/audit-logs
// @access  Private
export const getAuditLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.find().populate("user", "name email").sort({ createdAt: -1 }).limit(100);
    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};
