import express from "express";
import multer from "multer";
import { authMiddleware } from "../src/middlewares/auth.js";
import { audioReprodutorAuth, audioReprodutorStreamAuth } from "../src/middlewares/audioReprodutorAuth.js";
import * as controller from "../controllers/audioReprodutorController.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Multer: memória para múltiplos arquivos (limite 500MB por arquivo para WAV)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
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
