#!/usr/bin/env node
/**
 * Gera migration.sql consolidando todas as migrations em ordem.
 * Uso: node database/build-migration.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "migrations_legacy");
const outputPath = path.join(__dirname, "migration.sql");

const SKIP = ["024_email_templates_global.sql"]; // IF/THEN inválido fora de procedure; 025 faz o mesmo

const files = fs.readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql") && !SKIP.includes(f))
  .sort();

let content = `-- Migration consolidada - gerada por build-migration.js
-- Contém todas as alterações de 001 a ${String(files.length).padStart(3, "0")}
-- Executada pelo MigrationService com logs por etapa

USE campauto;

`;

for (const file of files) {
  const stepName = file.replace(".sql", "");
  const filePath = path.join(migrationsDir, file);
  let sql = fs.readFileSync(filePath, "utf8");
  // Remover USE campauto; duplicado (já temos no início)
  sql = sql.replace(/^USE\s+campauto\s*;\s*\n?/im, "");
  // Remover comentários de cabeçalho das migrations individuais (opcional)
  content += `-- ========== STEP: ${stepName} ==========\n`;
  content += sql.trim() + "\n\n";
}

fs.writeFileSync(outputPath, content, "utf8");
console.log(`✅ migration.sql gerada com ${files.length} etapas`);
console.log(`   Arquivo: ${outputPath}`);
