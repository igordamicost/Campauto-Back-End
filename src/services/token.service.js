import jwt from "jsonwebtoken";

export const generateResetToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "15m" });

export const verifyResetToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET);
