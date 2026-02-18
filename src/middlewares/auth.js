import jwt from "jsonwebtoken";
import { db } from "../config/database.js";

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Token inválido ou ausente" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Enriquecer req.user com informações da role (para compatibilidade com middlewares antigos)
    if (payload.roleId) {
      try {
        const [roleRows] = await db.query(
          "SELECT name FROM roles WHERE id = ?",
          [payload.roleId]
        );
        if (roleRows.length > 0) {
          payload.role = roleRows[0].name; // Adicionar role como string para compatibilidade
        }
      } catch (error) {
        // Se não conseguir buscar role, continua sem ela (fallback)
        console.warn("Erro ao buscar role do usuário:", error.message);
      }
    }
    
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
}
