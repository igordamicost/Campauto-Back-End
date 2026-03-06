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

    // Inserir módulos se a tabela existir (migration 038/042)
    try {
      await db.query(`
        INSERT IGNORE INTO modules (\`key\`, label, description) VALUES
          ('dashboard', 'Dashboard', 'Mapa do sistema e visão geral'),
          ('vendas', 'Vendas', 'Módulo de vendas, orçamentos e pedidos'),
          ('clientes', 'Clientes', 'Clientes físicos, jurídicos e veículos'),
          ('oficina', 'Oficina', 'Ordens de serviço e pátio'),
          ('estoque', 'Estoque', 'Produtos, saldos, movimentações e reservas'),
          ('financeiro', 'Financeiro', 'Contas a receber/pagar, caixa, fluxo e NF'),
          ('contabil', 'Fiscal/Contábil', 'Exportações e DRE'),
          ('relatorios', 'Relatórios', 'Relatórios de vendas, oficina, estoque e financeiro'),
          ('admin', 'Administração', 'Empresas, usuários, roles, templates e configurações'),
          ('rh', 'RH', 'Funcionários e cargos'),
          ('vinculos', 'Vínculos', 'Vínculos entre produtos e fábricas')
      `);
    } catch (modErr) {
      if (modErr.code !== "ER_NO_SUCH_TABLE") console.warn("Seed modules:", modErr.message);
    }
    try {
      await db.query(`
        UPDATE permissions p
        INNER JOIN modules m ON m.\`key\` = p.module
        SET p.module_id = m.id
        WHERE p.module_id IS NULL AND p.module IS NOT NULL
      `);
    } catch (updErr) {
      if (updErr.code !== "ER_NO_SUCH_TABLE" && updErr.code !== "ER_BAD_FIELD_ERROR") {
        console.warn("Seed permissions module_id:", updErr.message);
      }
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
      VALUES ('DEV', 'Desenvolvedor - Acesso total. Única role que pode editar MASTER e configurar o sistema.')
      ON DUPLICATE KEY UPDATE description = VALUES(description)
    `);

    // Inserir permissões se não existirem
    await db.query(`
      INSERT IGNORE INTO permissions (\`key\`, description, module) VALUES
        ('dashboard.view', 'Visualizar dashboard', 'dashboard'),
        ('sales.read', 'Visualizar vendas', 'vendas'),
        ('sales.create', 'Criar vendas', 'vendas'),
        ('sales.update', 'Editar vendas', 'vendas'),
        ('sales.delete', 'Excluir vendas/orçamentos', 'vendas'),
        ('commissions.read', 'Visualizar comissões', 'vendas'),
        ('reports.my_sales.read', 'Visualizar minhas vendas', 'vendas'),
        ('reports.read', 'Visualizar relatórios', 'relatorios'),
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
        ('admin.read', 'Acesso geral à administração', 'admin'),
        ('admin.users.manage', 'Gerenciar usuários', 'admin'),
        ('admin.roles.manage', 'Gerenciar roles', 'admin'),
        ('admin.companies.manage', 'Gerenciar empresas', 'admin'),
        ('admin.templates.manage', 'Gerenciar templates', 'admin'),
        ('admin.integrations.manage', 'Gerenciar integrações', 'admin'),
        ('vinculos.read', 'Visualizar vínculos de produtos e fábricas', 'vinculos'),
        ('vinculos.create', 'Criar vínculos e cadastrar fábricas', 'vinculos'),
        ('vinculos.update', 'Editar vínculos e fábricas', 'vinculos'),
        ('vinculos.delete', 'Remover vínculos e fábricas', 'vinculos')
    `);

    // Buscar IDs das permissões
    const [permissions] = await db.query("SELECT id, `key` FROM permissions");

    const permMap = {};
    permissions.forEach((p) => {
      permMap[p.key] = p.id;
    });

    // Política: apenas DEV tem permissões. Demais roles iniciam sem acesso.
    await db.query("DELETE FROM role_permissions");

    const [devRole] = await db.query("SELECT id FROM roles WHERE name = 'DEV' LIMIT 1");
    if (devRole.length > 0 && permissions.length > 0) {
      const devId = devRole[0].id;
      const devPerms = permissions.map((p) => [devId, p.id]);
      await db.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ?`,
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

    console.log("✅ Roles e permissões verificadas/atualizadas");
  } catch (error) {
    console.error("❌ Erro ao fazer seed de RBAC:", error);
    // Não lançar erro para não bloquear inicialização
  }
}
