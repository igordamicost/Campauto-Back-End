import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { authMiddleware } from "../src/middlewares/auth.js";
import { audioReprodutorAuth, audioReprodutorStreamAuth } from "../src/middlewares/audioReprodutorAuth.js";
import * as controller from "../controllers/audioReprodutorController.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Multer: disco para arquivos grandes (limite 4 GB por arquivo para WAV)
const uploadDir = path.join(__dirname, "../uploads/audio-reprodutor-temp");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`),
  }),
  limits: { fileSize: 4 * 1024 * 1024 * 1024 }, // 4 GB por arquivo
});

// Stream: aceita ?token= ou Bearer (para <audio src>)
router.get("/files/:id/stream", audioReprodutorStreamAuth, asyncHandler(controller.streamFile));

// Demais rotas: auth + restrição user 2 ou 14
router.use(authMiddleware);
router.use(audioReprodutorAuth);

router.get("/files", asyncHandler(controller.listFiles));
router.post(
  "/files",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "files", maxCount: 20 },
  ]),
  asyncHandler(controller.uploadFiles)
);
router.delete("/files/:id", asyncHandler(controller.deleteFile));
router.get("/history", asyncHandler(controller.getHistory));
router.patch("/history/:fileId", asyncHandler(controller.updateHistory));
router.get("/stats", asyncHandler(controller.getStats));

export default router;
