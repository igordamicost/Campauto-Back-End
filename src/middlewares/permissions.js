import { RBACRepository } from "../repositories/rbac.repository.js";

/**
 * Middleware que verifica se o usuário tem uma permissão específica
 * @param {string|string[]} permissionKeys - Chave(s) de permissão necessária(s)
 */
export function requirePermission(permissionKeys) {
  const permissions = Array.isArray(permissionKeys) ? permissionKeys : [permissionKeys];

  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const userId = req.user.userId;

      // Verificar cada permissão
      for (const permissionKey of permissions) {
        const hasPermission = await RBACRepository.userHasPermission(
          userId,
          permissionKey
        );

        if (hasPermission) {
          return next(); // Usuário tem pelo menos uma das permissões
        }
      }

      // Se chegou aqui, não tem nenhuma das permissões
      return res.status(403).json({
        message: "Acesso negado. Permissão necessária.",
        required: permissions,
      });
    } catch (error) {
      console.error("Error checking permission:", error);
      return res.status(500).json({ message: "Erro ao verificar permissão" });
    }
  };
}

/**
 * Middleware que verifica se o usuário tem uma das roles especificadas
 * @param {string|string[]} roleNames - Nome(s) da(s) role(s) necessária(s)
 */
export function requireRole(roleNames) {
  const roles = Array.isArray(roleNames) ? roleNames : [roleNames];

  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const userId = req.user.userId;
      const userRole = await RBACRepository.getUserRole(userId);

      if (!userRole) {
        return res.status(403).json({ message: "Role não encontrada" });
      }

      if (roles.includes(userRole.name)) {
        return next();
      }

      return res.status(403).json({
        message: "Acesso negado. Role necessária.",
        required: roles,
        current: userRole.name,
      });
    } catch (error) {
      console.error("Error checking role:", error);
      return res.status(500).json({ message: "Erro ao verificar role" });
    }
  };
}

/**
 * Middleware que verifica se o usuário é MASTER
 */
export const requireMaster = requireRole("MASTER");

/**
 * Middleware que verifica se o usuário é ADMIN ou MASTER
 */
export const requireAdmin = requireRole(["ADMIN", "MASTER"]);
