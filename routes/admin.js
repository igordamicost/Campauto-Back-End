import express from "express";
import adminController from "../controllers/adminController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { requirePermission } from "../src/middlewares/permissions.js";

const router = express.Router();

// Todas as rotas requerem autenticação e permissão de admin
router.use(authMiddleware);
router.use(requirePermission("admin.users.manage"));

// Usuários
router.get("/users", adminController.listUsers);
router.get("/users/:id", adminController.getUserById);
router.post("/users", adminController.createUser);
router.put("/users/:id", adminController.updateUser);
router.delete("/users/:id", adminController.deleteUser);

// Roles e Permissões (requer permissão específica)
router.get("/roles", requirePermission("admin.roles.manage"), adminController.listRoles);
router.get("/roles/:id", requirePermission("admin.roles.manage"), adminController.getRoleById);
router.post("/roles", requirePermission("admin.roles.manage"), adminController.createRole);
router.put("/roles/:id", requirePermission("admin.roles.manage"), adminController.updateRole);
router.get("/permissions", requirePermission("admin.roles.manage"), adminController.listPermissions);
router.post("/permissions", requirePermission("admin.roles.manage"), adminController.createPermission);
router.get("/roles/:id/permissions", requirePermission("admin.roles.manage"), adminController.getRolePermissions);
router.put("/roles/:id/permissions", requirePermission("admin.roles.manage"), adminController.updateRolePermissions);

export default router;
