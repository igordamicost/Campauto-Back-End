/**
 * Middleware: apenas usuários com role DEV podem prosseguir.
 * MASTER não tem mais acesso - apenas DEV possui bypass total.
 */
export async function masterOnly(req, res, next) {
  const role = String(req.user?.role || "").toUpperCase();
  if (role === "DEV") {
    return next();
  }

  if (req.user?.userId && !req.user.role) {
    try {
      const { db } = await import("../config/database.js");
      const [rows] = await db.query(
        "SELECT r.name FROM users u INNER JOIN roles r ON u.role_id = r.id WHERE u.id = ?",
        [req.user.userId]
      );
      if (rows.length > 0) {
        const roleName = String(rows[0].name || "").toUpperCase();
        if (roleName === "DEV") {
          return next();
        }
      }
    } catch (error) {
      // Se falhar, continua para retornar 403
    }
  }

  return res.status(403).json({ message: "Acesso restrito a administradores (role DEV)" });
}
