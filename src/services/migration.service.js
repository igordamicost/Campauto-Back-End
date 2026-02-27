import { db } from "../config/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Serviço para executar migrations automaticamente
 */
export class MigrationService {
  /**
   * Verifica se uma tabela existe
   */
  static async tableExists(tableName) {
    try {
      const [rows] = await db.query(
        `SELECT COUNT(*) AS count 
         FROM information_schema.tables 
         WHERE table_schema = DATABASE() AND table_name = ?`,
        [tableName]
      );
      return rows[0].count > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Executa um arquivo SQL
   */
  static async executeSqlFile(filePath) {
    try {
      const sql = fs.readFileSync(filePath, "utf8");
      
      // Executar todo o SQL de uma vez (db já tem multipleStatements habilitado)
      await db.query(sql);
      return true;
    } catch (error) {
      console.error(`Erro ao executar migration ${filePath}:`, error.message);
      // Não lançar erro para não bloquear outras migrations
      return false;
    }
  }

  /**
   * Executa migrations necessárias automaticamente
   */
  static async runMigrations() {
    console.log("🔄 Verificando e executando migrations...");

    const migrationsDir = path.join(__dirname, "../../database/migrations");
    const migrations = [
      {
        file: "003_rbac_system.sql",
        tables: ["roles", "permissions", "role_permissions"],
        name: "RBAC System",
      },
      {
        file: "004_stock_system.sql",
        tables: ["stock_locations", "stock_balances", "stock_movements"],
        name: "Stock System",
      },
      {
        file: "005_reservations_system.sql",
        tables: ["reservations", "reservation_events"],
        name: "Reservations System",
      },
      {
        file: "006_sales_commissions.sql",
        tables: ["sales", "sale_items", "commissions"],
        name: "Sales & Commissions",
      },
      {
        file: "007_notifications.sql",
        tables: ["notifications", "notification_sent_log"],
        name: "Notifications",
      },
      {
        file: "009_veiculos.sql",
        tables: ["veiculos"],
        name: "Veículos",
      },
      {
        file: "015_cotacoes_compra_fornecedores.sql",
        tables: ["cotacoes_compra", "fornecedores"],
        name: "Cotações de Compra e Fornecedores",
      },
      {
        file: "016_servicos.sql",
        tables: ["servicos", "servico_itens"],
        name: "Serviços (Administração)",
      },
      {
        file: "017_elevadores.sql",
        tables: ["elevadores"],
        name: "Elevadores (Administração / Pátio)",
      },
      {
        file: "018_orcamento_servicos_totais_historico.sql",
        tables: ["servico_item_valor_historico"],
        name: "Orçamento Serviços / Totais (legacy item histórico)",
      },
      {
        file: "019_servico_valor_historico.sql",
        tables: ["servico_valor_historico"],
        name: "Histórico de valor por Serviço",
      },
      {
        file: "020_stock_pending_nf.sql",
        tables: ["stock_pending_nf_applied"],
        name: "Estoque - Aguardando NF (qty_pending_nf)",
      },
      {
        file: "021_stock_by_empresa.sql",
        tables: ["stock_by_empresa_applied"],
        name: "Estoque por Empresa (empresa_id em saldos/movimentos/reservas)",
      },
      {
        file: "022_empresas_loja.sql",
        tables: ["empresas_loja_applied"],
        name: "Empresas - Campo loja (boolean)",
      },
    ];

    let executed = 0;

    for (const migration of migrations) {
      // Verificar se alguma tabela da migration não existe
      const missingTables = [];
      for (const table of migration.tables) {
        const exists = await this.tableExists(table);
        if (!exists) {
          missingTables.push(table);
        }
      }

      if (missingTables.length > 0) {
        console.log(
          `📦 Executando migration: ${migration.name} (tabelas faltantes: ${missingTables.join(", ")})`
        );
        const filePath = path.join(migrationsDir, migration.file);
        if (fs.existsSync(filePath)) {
          try {
            await this.executeSqlFile(filePath);
            console.log(`✅ Migration ${migration.name} executada com sucesso`);
            executed++;
          } catch (error) {
            console.error(
              `❌ Erro ao executar migration ${migration.name}:`,
              error.message
            );
            // Continuar com outras migrations mesmo se uma falhar
          }
        } else {
          console.warn(
            `⚠️  Arquivo de migration não encontrado: ${migration.file}`
          );
        }
      } else {
        console.log(`✓ Migration ${migration.name} já aplicada`);
      }
    }

    if (executed > 0) {
      console.log(`✅ ${executed} migration(s) executada(s) com sucesso`);
    } else {
      console.log("✓ Todas as migrations já estão aplicadas");
    }
  }
}
