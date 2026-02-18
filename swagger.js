import swaggerJSDoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Campauto API",
    version: "1.0.0",
    description: "API REST - Sistema completo de Mecânica + Distribuidora de Autopeças com RBAC, Reservas, Estoque, Notificações, Relatórios e Comissões"
  },
  servers: [
    {
      url: process.env.API_URL || "http://localhost:3000",
      description: process.env.NODE_ENV === "production" ? "Produção" : "Local"
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  }
};

const options = {
  swaggerDefinition,
  apis: ["./swagger/*.js"]
};

export default swaggerJSDoc(options);
