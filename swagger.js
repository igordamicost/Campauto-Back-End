import swaggerJSDoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Campauto API",
    version: "1.0.0",
    description: "API REST para clientes e produtos"
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local"
    }
  ]
};

const options = {
  swaggerDefinition,
  apis: ["./routes/*.js"]
};

export default swaggerJSDoc(options);
