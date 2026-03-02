import { db } from "../config/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STEP_REGEX = /^-- ========== STEP: (.+?) ==========/m;

/**
 * Serviço para executar migration consolidada com logs por etapa
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
   * Executa migration consolidada (database/migration.sql) com log por etapa
   */
  static async runMigrations() {
    const migrationPath = path.join(__dirname, "../../database/migration.sql");

    if (!fs.existsSync(migrationPath)) {
      console.log("⚠️  migration.sql não encontrada. Execute: node database/build-migration.js");
      return;
    }

    const content = fs.readFileSync(migrationPath, "utf8");
    const steps = this.parseSteps(content);

    if (steps.length === 0) {
      console.log("✓ Nenhuma etapa encontrada em migration.sql");
      return;
    }

    console.log(`🔄 Executando migration consolidada (${steps.length} etapas)...`);

    let executed = 0;
    for (let i = 0; i < steps.length; i++) {
      const { name, sql } = steps[i];
      const num = String(i + 1).padStart(2, "0");
      const total = String(steps.length).padStart(2, "0");

      try {
        process.stdout.write(`   [${num}/${total}] ${name}... `);
        await db.query(sql);
        console.log("✓");
        executed++;
      } catch (error) {
        console.log("✗");
        console.error(`   ❌ Erro em ${name}:`, error.message);
        // Continuar com próximas etapas (algumas podem falhar se já aplicadas)
      }
    }

    console.log(`✅ Migration: ${executed}/${steps.length} etapas executadas`);
  }

  /**
   * Parse do arquivo SQL em etapas (por marcador STEP)
   */
  static parseSteps(content) {
    const steps = [];
    const parts = content.split(STEP_REGEX);

    for (let i = 1; i < parts.length; i += 2) {
      const name = parts[i]?.trim() || `step_${i}`;
      const sql = (parts[i + 1] || "").trim();
      if (sql) {
        steps.push({ name, sql });
      }
    }

    return steps;
  }
}
