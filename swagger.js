import swaggerJSDoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Campauto API",
    version: "1.0.0",
    description: "API REST - Auth, Usuários, Clientes, Produtos, Empresas, Orçamentos, Relatórios, Integrações Gmail e Templates de E-mail"
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
