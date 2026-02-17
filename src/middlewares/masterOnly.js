/**
 * Middleware: apenas usuários com role MASTER podem prosseguir.
 * Deve ser usado após authMiddleware.
 */
export function masterOnly(req, res, next) {
  const role = String(req.user?.role || "").toUpperCase();
  if (role !== "MASTER") {
    return res.status(403).json({ message: "Acesso restrito a administradores" });
  }
  next();
}
