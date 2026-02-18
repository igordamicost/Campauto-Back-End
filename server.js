import "./src/config/env.js";
import app from "./app.js";
import { initDb } from "./db.js";
import { importAllCsv } from "./importCsv.js";
import { seedMasterUser } from "./src/seed/masterUser.js";
import { seedEmailTemplates } from "./src/seed/emailTemplatesSeed.js";
import { seedRBAC } from "./src/seed/rbacSeed.js";
import { verifyDbConnection } from "./src/config/database.js";
import { verifyEmailConnection } from "./src/config/email.js";
import { ReservationSchedulerService } from "./src/services/reservationScheduler.service.js";
import { MigrationService } from "./src/services/migration.service.js";

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  await initDb();
  await verifyDbConnection();
  
  // Executar migrations automaticamente se necessário
  await MigrationService.runMigrations();
  
  await verifyEmailConnection();
  await seedMasterUser();
  await seedRBAC();
  await seedEmailTemplates();
  await importAllCsv();

  // Iniciar scheduler de reservas (só se tabelas existirem)
  try {
    const reservationsExist = await MigrationService.tableExists("reservations");
    if (reservationsExist) {
      ReservationSchedulerService.start();
    } else {
      console.log("⚠️  Scheduler de reservas não iniciado (tabelas não criadas)");
    }
  } catch (error) {
    console.warn("⚠️  Erro ao verificar tabela reservations:", error.message);
  }

  app.listen(PORT, () => {
    console.log("🚀 API running");
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
