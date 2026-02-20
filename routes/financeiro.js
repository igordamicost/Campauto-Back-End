import express from "express";
import * as contasReceberController from "../controllers/contasReceberController.js";
import * as contasPagarController from "../controllers/contasPagarController.js";
import * as caixaController from "../controllers/caixaController.js";
import { authMiddleware } from "../src/middlewares/auth.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authMiddleware);

// Contas a Receber
router.get('/contas-receber', asyncHandler(contasReceberController.list));
router.get('/contas-receber/:id', asyncHandler(contasReceberController.getById));
router.post('/contas-receber', asyncHandler(contasReceberController.create));
router.put('/contas-receber/:id', asyncHandler(contasReceberController.update));
router.delete('/contas-receber/:id', asyncHandler(contasReceberController.remove));
router.patch('/contas-receber/:id/pagar', asyncHandler(contasReceberController.pagar));

// Contas a Pagar
router.get('/contas-pagar', asyncHandler(contasPagarController.list));
router.get('/contas-pagar/:id', asyncHandler(contasPagarController.getById));
router.post('/contas-pagar', asyncHandler(contasPagarController.create));
router.put('/contas-pagar/:id', asyncHandler(contasPagarController.update));
router.delete('/contas-pagar/:id', asyncHandler(contasPagarController.remove));
router.patch('/contas-pagar/:id/pagar', asyncHandler(contasPagarController.pagar));

// Caixa/Bancos
router.get('/caixa', asyncHandler(caixaController.list));
router.get('/caixa/:id', asyncHandler(caixaController.getById));
router.post('/caixa', asyncHandler(caixaController.create));
router.put('/caixa/:id', asyncHandler(caixaController.update));
router.delete('/caixa/:id', asyncHandler(caixaController.remove));
router.get('/caixa/:id/extrato', asyncHandler(caixaController.getExtrato));
router.get('/caixa/saldos', asyncHandler(caixaController.getSaldos));
router.post('/caixa/movimentacoes', asyncHandler(caixaController.createMovimentacao));

export default router;
