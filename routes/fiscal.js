import express from "express";
import * as controller from "../controllers/fiscalController.js";
import { authMiddleware } from "../src/middlewares/auth.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Webhook Focus (sem auth - Focus envia POST diretamente)
router.post("/webhook/nfe", asyncHandler(controller.webhookNfe));

router.use(authMiddleware);

router.get("/exportacoes", asyncHandler(controller.listExportacoes));

// Focus NFe - Configuração
router.post("/focus/empresa", asyncHandler(controller.configurarEmpresa));

// Focus NFe - NFe
router.post("/focus/nfe/emitir", asyncHandler(controller.emitirNFe));
router.get("/focus/nfe/:referencia", asyncHandler(controller.consultarNFe));
router.get("/focus/nfe/:referencia/poll", asyncHandler(controller.pollNfeStatus));
router.delete("/focus/nfe/:referencia", asyncHandler(controller.cancelarNFe));

// Focus NFe - NFSe
router.post("/focus/nfse/emitir", asyncHandler(controller.emitirNFSe));
router.get("/focus/nfse/:referencia", asyncHandler(controller.consultarNFSe));

// Focus NFe - Recebidas e cache
router.get("/focus/nfes-recebidas", asyncHandler(controller.listarNfesRecebidas));
router.post("/focus/vincular-pedido", asyncHandler(controller.vincularNfeRecebidaPedido));
router.get("/focus/notas", asyncHandler(controller.listarNotasCache));

export default router;
