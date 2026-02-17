import "./src/config/env.js";
import app from "./app.js";
import { initDb } from "./db.js";
import { importAllCsv } from "./importCsv.js";
import { seedMasterUser } from "./src/seed/masterUser.js";
import { seedEmailTemplates } from "./src/seed/emailTemplatesSeed.js";
import { verifyDbConnection } from "./src/config/database.js";
import { verifyEmailConnection } from "./src/config/email.js";

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  await initDb();
  await verifyDbConnection();
  await verifyEmailConnection();
  await seedMasterUser();
  await seedEmailTemplates();
  await importAllCsv();

  app.listen(PORT, () => {
    console.log("🚀 API running");
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
