import { db } from "../config/database.js";

/**
 * Seed inicial do menu (só executa se menu_items estiver vazio)
 * O menu completo é inserido pela migration 044_menu_seed.sql
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

    // Inserir apenas itens raiz básicos (migration 044 tem o menu completo)
    const items = [
      { parent_id: null, module_key: "dashboard", label: "Mapa do Sistema", path: "/dashboard", icon: "LayoutDashboard", order: 0, permission: "dashboard.view" },
      { parent_id: null, module_key: "vendas", label: "Vendas", path: null, icon: "ShoppingCart", order: 1, permission: "sales.read" },
      { parent_id: null, module_key: "clientes", label: "Clientes", path: null, icon: "UserCircle", order: 2, permission: "sales.read" },
      { parent_id: null, module_key: "oficina", label: "Oficina", path: null, icon: "Wrench", order: 3, permission: "service_orders.read" },
      { parent_id: null, module_key: "estoque", label: "Estoque", path: null, icon: "Package", order: 4, permission: "stock.read" },
      { parent_id: null, module_key: "financeiro", label: "Financeiro", path: null, icon: "DollarSign", order: 5, permission: "finance.read" },
      { parent_id: null, module_key: "contabil", label: "Fiscal/Contábil", path: null, icon: "FileText", order: 6, permission: "accounting.read" },
      { parent_id: null, module_key: "relatorios", label: "Relatórios", path: null, icon: "BarChart3", order: 7, permission: "reports.read" },
      { parent_id: null, module_key: "admin", label: "Administração", path: null, icon: "Settings", order: 8, permission: "admin.roles.manage" },
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
