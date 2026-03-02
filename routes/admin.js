import express from "express";
import adminController from "../controllers/adminController.js";
import menuController from "../controllers/menuController.js";
import * as servicosController from "../controllers/servicosController.js";
import * as elevadoresController from "../controllers/elevadoresController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { requirePermission, requireSystemConfig } from "../src/middlewares/permissions.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Todas as rotas requerem autenticação e permissão de admin
router.use(authMiddleware);
router.use(requirePermission("admin.users.manage"));

// Serviços (Administração > Serviços) – rotas aninhadas antes de /:id
router.get("/servicos", asyncHandler(servicosController.list));
router.post("/servicos", asyncHandler(servicosController.create));
router.get("/servicos/:servicoId/itens", asyncHandler(servicosController.listItens));
router.post("/servicos/:servicoId/itens", asyncHandler(servicosController.createItem));
router.put("/servicos/:servicoId/itens/:id", asyncHandler(servicosController.updateItem));
router.delete("/servicos/:servicoId/itens/:id", asyncHandler(servicosController.removeItem));
router.get("/servicos/:id", asyncHandler(servicosController.getById));
router.put("/servicos/:id", asyncHandler(servicosController.update));
router.delete("/servicos/:id", asyncHandler(servicosController.remove));

// Elevadores (Administração > Elevadores)
router.get("/elevadores", asyncHandler(elevadoresController.list));
router.get("/elevadores/:id", asyncHandler(elevadoresController.getById));
router.post("/elevadores", asyncHandler(elevadoresController.create));
router.put("/elevadores/:id", asyncHandler(elevadoresController.update));
router.delete("/elevadores/:id", asyncHandler(elevadoresController.remove));

// Usuários
router.get("/users", adminController.listUsers);
router.get("/users/:id", adminController.getUserById);
router.post("/users", adminController.createUser);
router.put("/users/:id", adminController.updateUser);
router.delete("/users/:id", adminController.deleteUser);

// Menu (apenas role com system.config)
router.get("/menu", requireSystemConfig, menuController.listAdminMenu);
router.post("/menu", requireSystemConfig, menuController.createMenuItem);
router.put("/menu/:id", requireSystemConfig, menuController.updateMenuItem);
router.delete("/menu/:id", requireSystemConfig, menuController.deleteMenuItem);

// Módulos (apenas role com system.config)
router.get("/modules", requireSystemConfig, adminController.listModules);
router.get("/modules/:id", requireSystemConfig, adminController.getModuleById);
router.post("/modules", requireSystemConfig, adminController.createModule);
router.put("/modules/:id", requireSystemConfig, adminController.updateModule);
router.delete("/modules/:id", requireSystemConfig, adminController.deleteModule);

// Roles e Permissões (requer admin.roles.manage - DEV atribui a MASTER)
router.get("/roles", requirePermission("admin.roles.manage"), adminController.listRoles);
router.get("/roles/:id", requirePermission("admin.roles.manage"), adminController.getRoleById);
router.post("/roles", requirePermission("admin.roles.manage"), adminController.createRole);
router.put("/roles/:id", requirePermission("admin.roles.manage"), adminController.updateRole);
router.get("/permissions", requirePermission("admin.roles.manage"), adminController.listPermissions);
router.post("/permissions", requireSystemConfig, adminController.createPermission);
router.put("/permissions/:id", requireSystemConfig, adminController.updatePermission);
router.delete("/permissions/:id", requireSystemConfig, adminController.deletePermission);
router.get("/roles/:id/permissions", requirePermission("admin.roles.manage"), adminController.getRolePermissions);
router.put("/roles/:id/permissions", requirePermission("admin.roles.manage"), adminController.updateRolePermissions);

export default router;
