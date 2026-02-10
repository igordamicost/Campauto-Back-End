import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.js";

import clientesRoutes from "./routes/clientes.js";
import produtosRoutes from "./routes/produtos.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import healthRoutes from "./routes/health.js";
import empresasRoutes from "./routes/empresas.js";
import orcamentosRoutes from "./routes/orcamentos.js";
import relatoriosRoutes from "./routes/relatorios.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/clientes", clientesRoutes);
app.use("/produtos", produtosRoutes);
app.use("/users", usersRoutes);
app.use("/empresas", empresasRoutes);
app.use("/orcamentos", orcamentosRoutes);
app.use("/relatorios", relatoriosRoutes);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

export default app;
