import { db } from "../config/database.js";
import { StockRepository } from "../repositories/stock.repository.js";

/**
 * Extrai itens com produto_id e quantidade de json_itens
 */
function getItensComProduto(jsonItens) {
  if (!jsonItens) return [];
  if (typeof jsonItens === "string") {
    try {
      jsonItens = JSON.parse(jsonItens || "[]");
    } catch {
      return [];
    }
  }
  if (!Array.isArray(jsonItens)) return [];
  return jsonItens
    .map((item) => {
      const produtoId = Number(item?.produto_id ?? item?.product_id);
      const quantidade = Number(item?.quantidade ?? item?.quantity) || 0;
      if (!produtoId || quantidade <= 0) return null;
      return {
        produto_id: produtoId,
        descricao: item?.descricao ?? item?.product_name ?? "",
        quantidade_solicitada: quantidade,
      };
    })
    .filter(Boolean);
}

/**
 * Serviço de abastecimento de orçamento: check-supply e finalize
 */
export class OrcamentoSupplyService {
  /**
   * Verifica se o orçamento possui itens sem estoque (requer pedido de compra).
   * Retorna: { requer_pedido, pode_gerar_pedido, itens_sem_estoque }
   * - pode_gerar_pedido = true quando há pelo menos um item sem estoque suficiente
   */
  static async getRequerPedidoCompra(orcamentoId) {
    const [rows] = await db.query(
      "SELECT id, empresa_id, json_itens FROM orcamentos WHERE id = ?",
      [orcamentoId]
    );
    const orcamento = rows[0];
    if (!orcamento) return null;
    return this.getRequerPedidoCompraFromOrcamento(orcamento);
  }

  /**
   * Calcula requer_pedido a partir de um row de orçamento (id, empresa_id, json_itens)
   */
  static async getRequerPedidoCompraFromOrcamento(orcamento) {
    const itens = getItensComProduto(orcamento.json_itens);
    if (itens.length === 0) {
      return {
        requer_pedido: false,
        pode_gerar_pedido: false,
        itens_sem_estoque: [],
      };
    }

    const empresaId = orcamento.empresa_id != null ? Number(orcamento.empresa_id) : null;
    if (!empresaId) {
      return {
        requer_pedido: false,
        pode_gerar_pedido: false,
        itens_sem_estoque: [],
      };
    }

    const produtoIds = [...new Set(itens.map((i) => i.produto_id))];
    const placeholders = produtoIds.map(() => "?").join(",");
    const [stockRows] = await db.query(
      `SELECT product_id, qty_on_hand, qty_reserved, COALESCE(qty_in_budget, 0) AS qty_in_budget
       FROM stock_items
       WHERE product_id IN (${placeholders}) AND empresa_id = ?`,
      [...produtoIds, empresaId]
    );

    const saldoByProduto = new Map();
    for (const r of stockRows) {
      const disponivel = Number(r.qty_on_hand) - Number(r.qty_reserved) - Number(r.qty_in_budget);
      saldoByProduto.set(r.product_id, Math.max(0, disponivel));
    }

    const itensSemEstoque = [];
    for (const item of itens) {
      const saldo = saldoByProduto.get(item.produto_id) ?? 0;
      if (item.quantidade_solicitada > saldo) {
        itensSemEstoque.push({
          produto_id: item.produto_id,
          descricao: item.descricao,
          quantidade_solicitada: item.quantidade_solicitada,
          saldo_estoque: saldo,
        });
      }
    }

    const podeGerarPedido = itensSemEstoque.length > 0;
    return {
      requer_pedido: podeGerarPedido,
      pode_gerar_pedido: podeGerarPedido,
      itens_sem_estoque: itensSemEstoque,
    };
  }

  /**
   * Calcula pode_gerar_pedido para vários orçamentos de uma vez (batch).
   * orcamentos: array de { id, empresa_id, json_itens }
   * Retorna: Map<orcamentoId, { pode_gerar_pedido }>
   */
  static async getRequerPedidoCompraBatch(orcamentos) {
    const result = new Map();
    if (!orcamentos || orcamentos.length === 0) return result;

    const pairs = []; // { orcamentoId, empresaId, itens }
    for (const o of orcamentos) {
      const itens = getItensComProduto(o.json_itens);
      if (itens.length === 0) {
        result.set(o.id, { pode_gerar_pedido: false });
        continue;
      }
      const empresaId = o.empresa_id != null ? Number(o.empresa_id) : null;
      if (!empresaId) {
        result.set(o.id, { pode_gerar_pedido: false });
        continue;
      }
      pairs.push({ orcamentoId: o.id, empresaId, itens });
    }

    if (pairs.length === 0) return result;

    const allPairs = new Set();
    for (const p of pairs) {
      for (const it of p.itens) {
        allPairs.add(`${p.empresaId}-${it.produto_id}`);
      }
    }

    const conditions = [];
    const params = [];
    for (const key of allPairs) {
      const [empId, prodId] = key.split("-").map(Number);
      conditions.push("(product_id = ? AND empresa_id = ?)");
      params.push(prodId, empId);
    }
    const whereSql = conditions.join(" OR ");

    const [stockRows] = await db.query(
      `SELECT product_id, empresa_id, qty_on_hand, qty_reserved, COALESCE(qty_in_budget, 0) AS qty_in_budget
       FROM stock_items WHERE ${whereSql}`,
      params
    );

    const saldoByKey = new Map();
    for (const r of stockRows) {
      const disponivel = Number(r.qty_on_hand) - Number(r.qty_reserved) - Number(r.qty_in_budget);
      saldoByKey.set(`${r.empresa_id}-${r.product_id}`, Math.max(0, disponivel));
    }

    for (const p of pairs) {
      let podeGerarPedido = false;
      for (const it of p.itens) {
        const saldo = saldoByKey.get(`${p.empresaId}-${it.produto_id}`) ?? 0;
        if (it.quantidade_solicitada > saldo) {
          podeGerarPedido = true;
          break;
        }
      }
      result.set(p.orcamentoId, { pode_gerar_pedido: podeGerarPedido });
    }

    return result;
  }

  /**
   * Verifica disponibilidade por item e cria pré-pedido ou transfer_order se necessário
   * Regra: in_stock | needs_transfer (+ transfer_order_id) | needs_purchase (+ pre_order_id)
   */
  static async checkSupply(orcamentoId, items, itemIndex = null) {
    const [orcRows] = await db.query(
      "SELECT id, empresa_id FROM orcamentos WHERE id = ?",
      [orcamentoId]
    );
    const orcamento = orcRows[0];
    if (!orcamento) throw new Error("Orçamento não encontrado");
    const empresaEmissoraId = orcamento.empresa_id;
    if (!empresaEmissoraId) throw new Error("Orçamento sem empresa emissora");

    let itemsToCheck = items;
    if (itemIndex != null) {
      const idx = Number(itemIndex);
      if (items[idx] == null) throw new Error("Índice de item inválido");
      itemsToCheck = [items[idx]];
    }

    const result = [];
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      for (let i = 0; i < itemsToCheck.length; i++) {
        const item = itemsToCheck[i];
        const produtoId = Number(item?.produto_id ?? item?.product_id);
        const quantidade = Number(item?.quantidade ?? item?.quantity) || 0;
        if (!produtoId || quantidade <= 0) {
          result.push({ produto_id: produtoId, supply_status: "invalid", pre_order_id: null, transfer_order_id: null });
          continue;
        }

        const availability = await StockRepository.getAvailabilityExtended(produtoId, quantidade, empresaEmissoraId);

        let supplyStatus = "in_stock";
        let preOrderId = null;
        let transferOrderId = null;

        if (availability.supply_action === "needs_transfer") {
          const empresaOrigem = availability.empresa_with_stock_id;
          const [existingRows] = await connection.query(
            `SELECT tro.id FROM transfer_orders tro
             INNER JOIN transfer_order_items toi ON toi.transfer_order_id = tro.id
             WHERE tro.orcamento_id = ? AND tro.empresa_origem_id = ? AND tro.empresa_destino_id = ?
               AND toi.product_id = ? AND tro.status NOT IN ('canceled', 'received')
             LIMIT 1`,
            [orcamentoId, empresaOrigem, empresaEmissoraId, produtoId]
          );
          const existing = existingRows[0]?.id;
          if (existing) {
            supplyStatus = "needs_transfer";
            transferOrderId = existing;
          } else {
            const [ins] = await connection.query(
              `INSERT INTO transfer_orders (orcamento_id, empresa_origem_id, empresa_destino_id, status)
               VALUES (?, ?, ?, 'draft')`,
              [orcamentoId, empresaOrigem, empresaEmissoraId]
            );
            await connection.query(
              `INSERT INTO transfer_order_items (transfer_order_id, product_id, quantity)
               VALUES (?, ?, ?)`,
              [ins.insertId, produtoId, quantidade]
            );
            supplyStatus = "needs_transfer";
            transferOrderId = ins.insertId;
          }
        } else if (availability.supply_action === "needs_purchase") {
          const [existingRows] = await connection.query(
            `SELECT po.id FROM pre_orders po
             INNER JOIN pre_order_items poi ON poi.pre_order_id = po.id
             WHERE po.orcamento_id = ? AND poi.product_id = ?
               AND po.status NOT IN ('canceled', 'received')
             LIMIT 1`,
            [orcamentoId, produtoId]
          );
          const existing = existingRows[0]?.id;
          if (existing) {
            supplyStatus = "needs_purchase";
            preOrderId = existing;
          } else {
            const [ins] = await connection.query(
              `INSERT INTO pre_orders (orcamento_id, status) VALUES (?, 'created')`,
              [orcamentoId]
            );
            await connection.query(
              `INSERT INTO pre_order_items (pre_order_id, product_id, quantity)
               VALUES (?, ?, ?)`,
              [ins.insertId, produtoId, quantidade]
            );
            supplyStatus = "needs_purchase";
            preOrderId = ins.insertId;
          }
        }

        result.push({
          produto_id: produtoId,
          supply_status: supplyStatus,
          pre_order_id: preOrderId,
          transfer_order_id: transferOrderId,
        });
      }

      await connection.commit();
      return { items: result };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Finaliza orçamento: baixa estoque, zera qty_in_budget, gera SalesLog
   */
  static async finalize(orcamentoId, userId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [orcRows] = await connection.query(
        "SELECT * FROM orcamentos WHERE id = ?",
        [orcamentoId]
      );
      const orcamento = orcRows[0];
      if (!orcamento) throw new Error("Orçamento não encontrado");
      if (orcamento.status === "Finalizado") throw new Error("Orçamento já finalizado");
      if (orcamento.status === "Cancelado") throw new Error("Orçamento cancelado");

      const empresaId = orcamento.empresa_id;
      if (!empresaId) throw new Error("Orçamento sem empresa emissora");

      let jsonItens = orcamento.json_itens;
      if (typeof jsonItens === "string") jsonItens = JSON.parse(jsonItens || "[]");
      if (!Array.isArray(jsonItens) || jsonItens.length === 0) {
        throw new Error("Orçamento sem itens de peças para dar baixa");
      }

      for (const item of jsonItens) {
        const produtoId = Number(item?.produto_id ?? item?.product_id);
        const quantidade = Number(item?.quantidade ?? item?.quantity) || 0;
        if (!produtoId || quantidade <= 0) continue;

        const [balRows] = await connection.query(
          "SELECT qty_on_hand, qty_reserved, COALESCE(qty_in_budget, 0) AS qty_in_budget FROM stock_items WHERE product_id = ? AND empresa_id = ?",
          [produtoId, empresaId]
        );
        const bal = balRows[0] || { qty_on_hand: 0, qty_reserved: 0, qty_in_budget: 0 };
        const disponivel = bal.qty_on_hand - bal.qty_reserved - bal.qty_in_budget;
        if (disponivel < quantidade) {
          throw new Error(
            `Produto ${produtoId}: quantidade insuficiente (disponível: ${disponivel}, solicitado: ${quantidade})`
          );
        }
      }

      for (const item of jsonItens) {
        const produtoId = Number(item?.produto_id ?? item?.product_id);
        const quantidade = Number(item?.quantidade ?? item?.quantity) || 0;
        const valorUnit = Number(item?.valor_unitario ?? item?.preco ?? 0) || 0;
        const total = Number(item?.total ?? valorUnit * quantidade) || 0;
        if (!produtoId || quantidade <= 0) continue;

        const [balRows] = await connection.query(
          "SELECT qty_on_hand FROM stock_items WHERE product_id = ? AND empresa_id = ?",
          [produtoId, empresaId]
        );
        const qtyBefore = balRows[0]?.qty_on_hand ?? 0;
        const qtyAfter = qtyBefore - quantidade;

        await connection.query(
          `UPDATE stock_items SET qty_on_hand = qty_on_hand - ?, qty_in_budget = GREATEST(0, COALESCE(qty_in_budget, 0) - ?)
           WHERE product_id = ? AND empresa_id = ?`,
          [quantidade, quantidade, produtoId, empresaId]
        );

        await connection.query(
          `INSERT INTO stock_movements (product_id, empresa_id, type, qty, qty_before, qty_after, ref_type, ref_id, notes, created_by)
           VALUES (?, ?, 'saida_venda', ?, ?, ?, 'ORCAMENTO', ?, ?, ?)`,
          [produtoId, empresaId, quantidade, qtyBefore, qtyAfter, orcamentoId, `Orçamento #${orcamento.numero_sequencial}`, userId]
        );

        await connection.query(
          `INSERT INTO sales_log (tipo, orcamento_id, produto_id, empresa_id, vendedor_id, cliente_id, veiculo_id, valor, quantidade, origem_item)
           VALUES ('venda', ?, ?, ?, ?, ?, ?, ?, ?, 'estoque')`,
          [
            orcamentoId,
            produtoId,
            empresaId,
            orcamento.usuario_id || userId,
            orcamento.cliente_id,
            orcamento.veiculo_id,
            total,
            quantidade,
          ]
        );
      }

      await connection.query(
        "UPDATE orcamentos SET status = 'Finalizado', data_atualizacao = NOW() WHERE id = ?",
        [orcamentoId]
      );

      await connection.commit();
      return { success: true };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Atualiza qty_in_budget: aplica delta (positivo = adiciona, negativo = remove)
   */
  static async updateQtyInBudgetDelta(empresaId, deltas) {
    if (!empresaId || !deltas || typeof deltas !== "object") return;
    for (const [produtoId, delta] of Object.entries(deltas)) {
      const qty = Number(delta);
      if (!produtoId || qty === 0) continue;
      await db.query(
        `INSERT INTO stock_items (product_id, empresa_id, qty_on_hand, qty_reserved, qty_in_budget)
         VALUES (?, ?, 0, 0, 0)
         ON DUPLICATE KEY UPDATE qty_in_budget = GREATEST(0, COALESCE(qty_in_budget, 0) + ?)`,
        [Number(produtoId), empresaId, qty]
      );
    }
  }

  /**
   * Recalcula qty_in_budget a partir de todos os orçamentos ativos (status != Finalizado, Cancelado)
   */
  static async recalcQtyInBudgetForEmpresa(empresaId) {
    const [rows] = await db.query(
      "SELECT id, json_itens FROM orcamentos WHERE empresa_id = ? AND status NOT IN ('Finalizado', 'Cancelado')",
      [empresaId]
    );
    const agg = {};
    for (const r of rows) {
      let itens = r.json_itens;
      if (typeof itens === "string") {
        try {
          itens = JSON.parse(itens || "[]");
        } catch {
          itens = [];
        }
      }
      if (!Array.isArray(itens)) continue;
      for (const item of itens) {
        const pid = Number(item?.produto_id ?? item?.product_id);
        const qty = Number(item?.quantidade ?? item?.quantity) || 0;
        if (!pid) continue;
        agg[pid] = (agg[pid] || 0) + qty;
      }
    }
    const connection = await db.getConnection();
    try {
      await connection.query(
        "UPDATE stock_items SET qty_in_budget = 0 WHERE empresa_id = ?",
        [empresaId]
      );
      for (const [pid, qty] of Object.entries(agg)) {
        if (qty <= 0) continue;
        await connection.query(
          `INSERT INTO stock_items (product_id, empresa_id, qty_on_hand, qty_reserved, qty_in_budget)
           VALUES (?, ?, 0, 0, ?)
           ON DUPLICATE KEY UPDATE qty_in_budget = ?`,
          [pid, empresaId, qty, qty]
        );
      }
    } finally {
      connection.release();
    }
  }
}
