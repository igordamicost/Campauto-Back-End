import { db } from "../config/database.js";

/**
 * Seed de Roles e Permissões
 * Garante que roles e permissões básicas existam
 */
export async function seedRBAC() {
  try {
    console.log("🌱 Verificando roles e permissões...");

    // Verificar se tabela roles existe
    const [tables] = await db.query(
      `SELECT COUNT(*) AS count 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() AND table_name = 'roles'`
    );

    if (tables[0].count === 0) {
      console.log("⚠️  Tabelas RBAC não encontradas. Execute as migrations primeiro.");
      return;
    }

    // Inserir roles se não existirem
    await db.query(`
      INSERT IGNORE INTO roles (id, name, description) VALUES
        (1, 'MASTER', 'Acesso total ao sistema'),
        (2, 'ADMIN', 'Administrador com acesso amplo'),
        (3, 'USER', 'Usuário padrão'),
        (4, 'ALMOX', 'Almoxarifado/Estoque'),
        (5, 'CONTAB', 'Contábil')
    `);

    // Inserir role DEV (por nome, para funcionar em qualquer ambiente)
    await db.query(`
      INSERT INTO roles (name, description)
      VALUES ('DEV', 'Desenvolvedor - Acesso total para configuração do sistema')
      ON DUPLICATE KEY UPDATE description = VALUES(description)
    `);

    // Inserir permissões se não existirem
    await db.query(`
      INSERT IGNORE INTO permissions (\`key\`, description, module) VALUES
        ('sales.read', 'Visualizar vendas', 'vendas'),
        ('sales.create', 'Criar vendas', 'vendas'),
        ('sales.update', 'Editar vendas', 'vendas'),
        ('commissions.read', 'Visualizar comissões', 'vendas'),
        ('reports.my_sales.read', 'Visualizar minhas vendas', 'vendas'),
        ('service_orders.read', 'Visualizar ordens de serviço', 'oficina'),
        ('service_orders.create', 'Criar ordens de serviço', 'oficina'),
        ('service_orders.update', 'Editar ordens de serviço', 'oficina'),
        ('checklists.read', 'Visualizar checklists', 'oficina'),
        ('checklists.update', 'Editar checklists', 'oficina'),
        ('stock.read', 'Visualizar estoque', 'estoque'),
        ('stock.move', 'Movimentar estoque', 'estoque'),
        ('stock.reserve.create', 'Criar reservas', 'estoque'),
        ('stock.reserve.update', 'Editar reservas', 'estoque'),
        ('stock.reserve.cancel', 'Cancelar reservas', 'estoque'),
        ('stock.inventory', 'Realizar inventário', 'estoque'),
        ('finance.read', 'Visualizar financeiro', 'financeiro'),
        ('finance.create', 'Criar lançamentos financeiros', 'financeiro'),
        ('finance.update', 'Editar lançamentos financeiros', 'financeiro'),
        ('hr.read', 'Visualizar RH', 'rh'),
        ('hr.create', 'Criar registros de RH', 'rh'),
        ('hr.update', 'Editar registros de RH', 'rh'),
        ('accounting.read', 'Visualizar contábil', 'contabil'),
        ('accounting.export', 'Exportar dados contábeis', 'contabil'),
        ('admin.users.manage', 'Gerenciar usuários', 'admin'),
        ('admin.roles.manage', 'Gerenciar roles', 'admin'),
        ('admin.companies.manage', 'Gerenciar empresas', 'admin'),
        ('admin.templates.manage', 'Gerenciar templates', 'admin'),
        ('admin.integrations.manage', 'Gerenciar integrações', 'admin')
    `);

    // Buscar IDs das permissões
    const [permissions] = await db.query("SELECT id, `key` FROM permissions");

    const permMap = {};
    permissions.forEach((p) => {
      permMap[p.key] = p.id;
    });

    // Atribuir permissões ao MASTER (todas)
    if (permissions.length > 0) {
      const masterPerms = permissions.map((p) => [1, p.id]);
      await db.query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES ?`,
        [masterPerms]
      );
    }

    // Atribuir permissões ao DEV (todas, como MASTER)
    const [devRole] = await db.query("SELECT id FROM roles WHERE name = 'DEV' LIMIT 1");
    if (devRole.length > 0 && permissions.length > 0) {
      const devId = devRole[0].id;
      const devPerms = permissions.map((p) => [devId, p.id]);
      await db.query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES ?`,
        [devPerms]
      );
    }

    // Atualizar usuário id 2 para role DEV (se existir)
    const [user2] = await db.query("SELECT id FROM users WHERE id = 2 LIMIT 1");
    if (user2.length > 0) {
      const [devRow] = await db.query("SELECT id FROM roles WHERE name = 'DEV' LIMIT 1");
      if (devRow.length > 0) {
        await db.query("UPDATE users SET role_id = ? WHERE id = 2", [devRow[0].id]);
      }
    }

    // Atribuir permissões ao ADMIN (todas exceto admin.users.manage)
    const adminPerms = permissions
      .filter((p) => p.key !== "admin.users.manage")
      .map((p) => [2, p.id]);
    if (adminPerms.length > 0) {
      await db.query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES ?`,
        [adminPerms]
      );
    }

    // Atribuir permissões ao USER
    const userPermKeys = [
      "sales.read",
      "sales.create",
      "reports.my_sales.read",
      "commissions.read",
      "stock.read",
      "stock.reserve.create",
    ];
    const userPerms = userPermKeys
      .map((key) => permMap[key])
      .filter(Boolean)
      .map((pid) => [3, pid]);
    if (userPerms.length > 0) {
      await db.query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES ?`,
        [userPerms]
      );
    }

    // Atribuir permissões ao ALMOX (tudo de estoque)
    const almoPermKeys = [
      "stock.read",
      "stock.move",
      "stock.reserve.create",
      "stock.reserve.update",
      "stock.reserve.cancel",
      "stock.inventory",
    ];
    const almoPerms = almoPermKeys
      .map((key) => permMap[key])
      .filter(Boolean)
      .map((pid) => [4, pid]);
    if (almoPerms.length > 0) {
      await db.query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES ?`,
        [almoPerms]
      );
    }

    // Atribuir permissões ao CONTAB
    const contabPermKeys = [
      "accounting.read",
      "accounting.export",
      "finance.read",
    ];
    const contabPerms = contabPermKeys
      .map((key) => permMap[key])
      .filter(Boolean)
      .map((pid) => [5, pid]);
    if (contabPerms.length > 0) {
      await db.query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES ?`,
        [contabPerms]
      );
    }

    console.log("✅ Roles e permissões verificadas/atualizadas");
  } catch (error) {
    console.error("❌ Erro ao fazer seed de RBAC:", error);
    // Não lançar erro para não bloquear inicialização
  }
}
