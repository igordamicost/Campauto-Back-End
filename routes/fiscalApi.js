/**
 * API v1 Fiscal - Contratos padronizados.
 * Base: /api/v1
 */

import express from "express";
import * as controller from "../controllers/fiscalApiController.js";
import { authMiddleware } from "../src/middlewares/auth.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authMiddleware);

// 1. Configuração Fiscal (cadastro Focus + certificado A1)
router.get("/configuracao-fiscal", asyncHandler(controller.obterConfiguracaoFiscal));
router.post("/configuracao-fiscal", asyncHandler(controller.configuracaoFiscal));

// 2. Emissão NFe (venda, garantia, devolução)
router.post("/nfe/emitir", asyncHandler(controller.emitirNFeV1));

// 3. Emissão NFSe (Campo Grande)
router.post("/nfse/emitir", asyncHandler(controller.emitirNFSeV1));

// 4. Notas Recebidas (consolidado: chave, nome_emitente, valor_total, data_emissao, no_estoque, pedido_vinculado)
router.get("/notas-recebidas", asyncHandler(controller.notasRecebidas));

// 5. Importar nota por chave (bipar) - busca XML na Focus e dá entrada no estoque
router.post("/notas-recebidas/importar-chave", asyncHandler(controller.importarPorChave));

// 6. Vincular NFe recebida a pedido (dar entrada no estoque)
router.post("/notas-recebidas/vincular", asyncHandler(controller.vincularPedido));

// 7. Cancelamento NFe
router.delete("/nfe/:referencia", asyncHandler(controller.cancelarNFeV1));

// 8. Consulta Status NFe (mapeado: autorizado, processando, erro)
router.get("/nfe/:referencia/status", asyncHandler(controller.statusNFe));

export default router;
