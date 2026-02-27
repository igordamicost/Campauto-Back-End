import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.js";
import client from "prom-client";

import clientesRoutes from "./routes/clientes.js";
import produtosRoutes from "./routes/produtos.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import healthRoutes from "./routes/health.js";
import empresasRoutes from "./routes/empresas.js";
import orcamentosRoutes from "./routes/orcamentos.js";
import relatoriosRoutes from "./routes/relatorios.js";
import integrationsRoutes from "./routes/integrations.js";
import emailTemplatesRoutes from "./routes/emailTemplates.js";
import adminRoutes from "./routes/admin.js";
import reservationsRoutes from "./routes/reservations.js";
import stockRoutes from "./routes/stock.js";
import reportsRoutes from "./routes/reports.js";
import commissionsRoutes from "./routes/commissions.js";
import notificationsRoutes from "./routes/notifications.js";
import veiculosRoutes from "./routes/veiculos.js";
import oficinaRoutes from "./routes/oficina.js";
import pessoasRoutes from "./routes/pessoas.js";
import fiscalRoutes from "./routes/fiscal.js";
import commissionRulesRoutes from "./routes/commissionRules.js";
import financeiroRoutes from "./routes/financeiro.js";
import cotacoesCompraRoutes from "./routes/cotacoesCompra.js";
import fornecedoresRoutes from "./routes/fornecedores.js";

const app = express();

app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ===================== MÉTRICAS PROMETHEUS =====================

// Coletar métricas padrão (CPU, memória, etc)
client.collectDefaultMetrics();

// Histograma de duração das requisições HTTP
const httpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duração das requisições HTTP em segundos",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

// Middleware para medir todas as requisições
app.use((req, res, next) => {
  const end = httpRequestDurationSeconds.startTimer();
  res.on("finish", () => {
    const route = req.route?.path || req.path || "unknown_route";
    end({ method: req.method, route, status_code: res.statusCode });
  });
  next();
});

// Endpoint de métricas para o Prometheus
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

// ===================== ROTAS DA APLICAÇÃO =====================

app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/clientes", clientesRoutes);
app.use("/produtos", produtosRoutes);
app.use("/users", usersRoutes);
app.use("/empresas", empresasRoutes);
app.use("/orcamentos", orcamentosRoutes);
app.use("/relatorios", relatoriosRoutes);
app.use("/integrations", integrationsRoutes);
app.use("/email-templates", emailTemplatesRoutes);
app.use("/admin", adminRoutes);
app.use("/reservations", reservationsRoutes);
app.use("/stock", stockRoutes);
app.use("/reports", reportsRoutes);
app.use("/commissions", commissionsRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/veiculos", veiculosRoutes);
app.use("/oficina", oficinaRoutes);
app.use("/pessoas", pessoasRoutes);
app.use("/fiscal", fiscalRoutes);
app.use("/admin/commission-rules", commissionRulesRoutes);
app.use("/financeiro", financeiroRoutes);
app.use("/cotacoes-compra", cotacoesCompraRoutes);
app.use("/fornecedores", fornecedoresRoutes);
app.use("/docs", swaggerUi.serve, (req, res, next) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const spec = {
    ...swaggerSpec,
    servers: [{ url: baseUrl, description: "API atual" }]
  };
  swaggerUi.setup(spec)(req, res, next);
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

export default app;