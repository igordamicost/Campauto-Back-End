import swaggerJSDoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Campauto API",
    version: "1.0.0",
    description: "API REST - Sistema completo de Mecânica + Distribuidora de Autopeças. Inclui RBAC, Auth (JWT + Refresh Token), Reservas, Estoque, Orçamentos, Pedidos de Compra, Financeiro, Oficina, Notificações, Relatórios e Comissões."
  },
  servers: [
    {
      url: process.env.API_URL || "http://localhost:3000",
      description: process.env.NODE_ENV === "production" ? "Produção" : "Local"
    }
  ],
  tags: [
    { name: "Sistema", description: "Health, métricas" },
    { name: "Auth", description: "Login, refresh, logout, recuperação de senha" },
    { name: "Health", description: "Status da API" },
    { name: "Clientes", description: "Cadastro de clientes" },
    { name: "Produtos", description: "Produtos" },
    { name: "Users", description: "Usuários" },
    { name: "Empresas", description: "Empresas" },
    { name: "Orçamentos", description: "Orçamentos de venda" },
    { name: "Relatórios", description: "Relatórios" },
    { name: "Estoque", description: "Saldos, movimentações, compras" },
    { name: "Reservas", description: "Reservas de estoque" },
    { name: "Pedidos de Compra", description: "Pedidos para fornecedores" },
    { name: "Fornecedores", description: "Fornecedores" },
    { name: "Cotações de Compra", description: "Cotações" },
    { name: "Financeiro", description: "Contas a pagar/receber, caixa" },
    { name: "Oficina", description: "Ordens de serviço, pátio" },
    { name: "Admin", description: "Serviços, elevadores, usuários, roles" },
    { name: "Comissões", description: "Comissões" },
    { name: "Notificações", description: "Notificações" },
    { name: "Veículos", description: "Veículos" },
    { name: "Pessoas", description: "Funcionários" },
    { name: "Fiscal", description: "Exportações fiscais" },
    { name: "Email Templates", description: "Templates de e-mail" },
    { name: "Integrations", description: "Integrações" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access token JWT (Header: Authorization Bearer <token>)"
      }
    }
  }
};

const options = {
  swaggerDefinition,
  apis: ["./swagger/*.js"]
};

export default swaggerJSDoc(options);
