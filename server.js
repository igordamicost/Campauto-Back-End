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

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  await initDb();
  await verifyDbConnection();
  await verifyEmailConnection();
  await seedMasterUser();
  await seedRBAC();
  await seedEmailTemplates();
  await importAllCsv();

  // Iniciar scheduler de reservas
  ReservationSchedulerService.start();

  app.listen(PORT, () => {
    console.log("🚀 API running");
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
