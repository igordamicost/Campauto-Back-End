/**
 * Serviço de entrada de estoque ao vincular NFe recebida a pedido de compra.
 * Percorre os itens da nota e incrementa a quantidade no banco de produtos/estoque.
 */

import { StockRepository } from "../repositories/stock.repository.js";
import { FocusNfRepository } from "../repositories/focusNf.repository.js";

/**
 * Executa entrada de estoque para todos os itens de uma NFe recebida vinculada a pedido.
 * @param {number} focusNfId - ID da nota em focus_nf
 * @param {number} empresaId - ID da empresa (para stock_balances)
 * @param {number} [createdBy] - ID do usuário que realizou a operação
 * @returns {{ imported: number, errors: string[], entries: Array }}
 */
export async function executarEntradaEstoque(focusNfId, empresaId, createdBy = null) {
  const itens = await FocusNfRepository.getItens(focusNfId);
  if (itens.length === 0) {
    return { imported: 0, errors: ["Nenhum item na nota"], entries: [] };
  }

  const entries = [];
  const errors = [];

  for (const it of itens) {
    const codigo = it.codigo_produto ? String(it.codigo_produto).trim() : null;
    if (!codigo) {
      errors.push(`Item ${it.numero_item} sem código`);
      continue;
    }

    const productId = await StockRepository.findProductByCode(codigo);
    if (!productId) {
      errors.push(`Produto não encontrado para código: ${codigo}`);
      continue;
    }

    const qty = Number(it.quantidade) || 0;
    if (qty <= 0) {
      errors.push(`Item ${it.numero_item} com quantidade inválida`);
      continue;
    }

    try {
      const movementId = await StockRepository.createMovement({
        product_id: productId,
        empresa_id: empresaId,
        type: "ENTRY",
        qty,
        ref_type: "focus_nfe_recebida",
        ref_id: focusNfId,
        notes: `Entrada por NFe recebida (focus_nf_id=${focusNfId})`,
        created_by: createdBy,
      });
      entries.push({ product_id: productId, codigo, quantidade: qty, movement_id: movementId });
    } catch (err) {
      errors.push(`Erro ao dar entrada para ${codigo}: ${err.message}`);
    }
  }

  return { imported: entries.length, errors: errors.length ? errors : undefined, entries };
}
