import express from "express";
import menuController from "../controllers/menuController.js";
import { authMiddleware } from "../src/middlewares/auth.js";

const router = express.Router();

router.get("/", authMiddleware, menuController.getMenu);

export default router;
