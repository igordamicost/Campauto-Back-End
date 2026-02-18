/**
 * Middleware: apenas usuários com role MASTER podem prosseguir.
 * Deve ser usado após authMiddleware.
 * Compatível com sistema antigo (role string) e novo (roleId número)
 */
export async function masterOnly(req, res, next) {
  // Verificar roleId primeiro (sistema novo RBAC) - roleId 1 = MASTER
  if (req.user?.roleId === 1) {
    return next();
  }
  
  // Verificar role string (sistema antigo ou se foi enriquecido pelo authMiddleware)
  const role = String(req.user?.role || "").toUpperCase();
  if (role === "MASTER") {
    return next();
  }
  
  // Se não tem roleId nem role, tentar buscar do banco
  if (req.user?.userId && !req.user.roleId && !req.user.role) {
    try {
      const { db } = await import("../config/database.js");
      const [rows] = await db.query(
        "SELECT role_id FROM users WHERE id = ?",
        [req.user.userId]
      );
      if (rows.length > 0 && rows[0].role_id === 1) {
        return next();
      }
    } catch (error) {
      // Se falhar, continua para retornar 403
    }
  }
  
  return res.status(403).json({ message: "Acesso restrito a administradores" });
}
