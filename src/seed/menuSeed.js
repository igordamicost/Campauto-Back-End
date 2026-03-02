import { db } from "../config/database.js";

/**
 * Seed inicial do menu
 */
export async function seedMenu() {
  try {
    const [tables] = await db.query(
      `SELECT COUNT(*) AS count FROM information_schema.tables 
       WHERE table_schema = DATABASE() AND table_name = 'menu_items'`
    );

    if (tables[0].count === 0) return;

    const [existing] = await db.query("SELECT COUNT(*) AS count FROM menu_items");
    if (existing[0].count > 0) return;

    const items = [
      { parent_id: null, module_key: "vendas", label: "Vendas", path: "/vendas", icon: "ShoppingCart", order: 1, permission: "sales.read" },
      { parent_id: null, module_key: "estoque", label: "Estoque", path: "/estoque", icon: "Package", order: 2, permission: "stock.read" },
      { parent_id: null, module_key: "oficina", label: "Oficina", path: "/oficina", icon: "Wrench", order: 3, permission: "service_orders.read" },
      { parent_id: null, module_key: "financeiro", label: "Financeiro", path: "/financeiro", icon: "DollarSign", order: 4, permission: "finance.read" },
      { parent_id: null, module_key: "admin", label: "Administração", path: "/admin", icon: "Settings", order: 5, permission: "admin.roles.manage" },
    ];

    for (const item of items) {
      await db.query(
        `INSERT INTO menu_items (parent_id, module_key, label, path, icon, \`order\`, permission)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.parent_id, item.module_key, item.label, item.path, item.icon, item.order, item.permission]
      );
    }

    console.log("✅ Menu inicial criado");
  } catch (error) {
    if (error.code !== "ER_NO_SUCH_TABLE") {
      console.warn("Seed menu:", error.message);
    }
  }
}
