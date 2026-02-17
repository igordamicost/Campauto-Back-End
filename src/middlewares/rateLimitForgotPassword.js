import rateLimit from "express-rate-limit";

/**
 * Rate limit para forgot-password: evita enumeração de emails e abuso.
 * Resposta sempre 200 com mensagem genérica.
 */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Se o email existir, você receberá instruções em breve" },
  standardHeaders: true,
  legacyHeaders: false,
});
