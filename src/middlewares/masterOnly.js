/**
 * Middleware: apenas usuários com permissão system.config podem prosseguir.
 * Autorização via role_id -> role_permissions (sem uso de nome de role).
 */
import { requirePermission } from "./permissions.js";

export const masterOnly = requirePermission("system.config");
