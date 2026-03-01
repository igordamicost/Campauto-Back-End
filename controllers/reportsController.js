import { db } from "../src/config/database.js";
import { CommissionService } from "../src/services/commissionService.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const TAG_VENDA_REALIZADA = "venda_realizada";
const TAG_VENDA_NAO_REALIZADA = "venda_nao_realizada";

/** Verifica se JSON array tags contém a tag (MySQL) */
function jsonContainsTag(tagsCol, tag) {
  return `JSON_CONTAINS(COALESCE(${tagsCol}, '[]'), '"${tag}"', '$')`;
}

function validateMonth(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return { error: "Parâmetro month é obrigatório no formato YYYY-MM" };
  }
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { startDate: `${month}-01`, endDate: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/**
 * Métricas do mês - Meu Desempenho
 * GET /reports/my-sales/metrics?month=YYYY-MM
 */
async function getMySalesMetrics(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Não autenticado" });

    const { month } = req.query;
    const validated = validateMonth(month);
    if (validated.error) {
      return res.status(400).json({ message: validated.error });
    }
    const { startDate, endDate } = validated;

    const hasVendaRealizada = jsonContainsTag("tags", TAG_VENDA_REALIZADA);
    const hasVendaNaoRealizada = jsonContainsTag("tags", TAG_VENDA_NAO_REALIZADA);

    const [rows] = await db.query(
      `SELECT
         COUNT(*) AS orcamentos,
         COALESCE(SUM(CASE WHEN ${hasVendaRealizada} THEN 1 ELSE 0 END), 0) AS quantidade_vendas,
         COALESCE(SUM(CASE WHEN ${hasVendaRealizada} THEN total ELSE 0 END), 0) AS vendas_reais,
         COALESCE(SUM(CASE WHEN ${hasVendaNaoRealizada} THEN 1 ELSE 0 END), 0) AS orcamentos_nao_fechados
       FROM orcamentos
       WHERE usuario_id = ?
         AND data >= ?
         AND data <= ?`,
      [userId, startDate, endDate]
    );

    const r = rows[0];
    return res.json({
      orcamentos: Number(r.orcamentos),
      vendas_reais: Number(r.vendas_reais),
      quantidade_vendas: Number(r.quantidade_vendas),
      orcamentos_nao_fechados: Number(r.orcamentos_nao_fechados),
    });
  } catch (error) {
    console.error("Error getting my sales metrics:", error);
    return res.status(500).json({ message: "Erro ao buscar métricas" });
  }
}

/**
 * Lista de vendas do mês (orçamentos com tag venda_realizada)
 * GET /reports/my-sales?month=YYYY-MM
 */
async function getMySales(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Não autenticado" });

    const { month } = req.query;
    const validated = validateMonth(month);
    if (validated.error) {
      return res.status(400).json({ message: validated.error });
    }
    const { startDate, endDate } = validated;

    const hasVendaRealizada = jsonContainsTag("o.tags", TAG_VENDA_REALIZADA);

    const [vendasRows] = await db.query(
      `SELECT o.id, o.data, o.total AS valor, o.status,
              c.fantasia, c.razao_social, c.cliente
       FROM orcamentos o
       LEFT JOIN clientes c ON c.id = o.cliente_id
       WHERE o.usuario_id = ?
         AND o.data >= ?
         AND o.data <= ?
         AND ${hasVendaRealizada}
       ORDER BY o.data DESC, o.id DESC`,
      [userId, startDate, endDate]
    );

    const vendas = vendasRows.map((row) => ({
      id: row.id,
      data: row.data ? String(row.data).slice(0, 10) : null,
      cliente_nome: row.fantasia || row.razao_social || row.cliente || "—",
      valor: Number(row.valor) || 0,
      status: row.status,
    }));

    const total = vendas.reduce((s, v) => s + v.valor, 0);

    return res.json({
      vendas,
      resumo: { total, quantidade: vendas.length },
    });
  } catch (error) {
    console.error("Error getting my sales:", error);
    return res.status(500).json({ message: "Erro ao buscar vendas" });
  }
}

/**
 * Evolução mensal (gráfico de linha)
 * GET /reports/my-sales/evolucao?months=12
 */
async function getMySalesEvolucao(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Não autenticado" });

    const months = Math.min(24, Math.max(1, Number(req.query.months) || 12));

    const hasVendaRealizada = jsonContainsTag("o.tags", TAG_VENDA_REALIZADA);

    const [rows] = await db.query(
      `SELECT
         DATE_FORMAT(o.data, '%Y-%m') AS month,
         COALESCE(SUM(o.total), 0) AS valor,
         COUNT(*) AS quantidade
       FROM orcamentos o
       WHERE o.usuario_id = ?
         AND ${hasVendaRealizada}
         AND o.data >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? MONTH), '%Y-%m-01')
       GROUP BY DATE_FORMAT(o.data, '%Y-%m')
       ORDER BY month ASC`,
      [userId, months]
    );

    const dataByMonth = new Map(rows.map((r) => [r.month, { valor: Number(r.valor), quantidade: Number(r.quantidade) }]));

    const evolucao = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const data = dataByMonth.get(month) || { valor: 0, quantidade: 0 };
      evolucao.push({ month, valor: data.valor, quantidade: data.quantidade });
    }

    return res.json({ evolucao });
  } catch (error) {
    console.error("Error getting my sales evolucao:", error);
    return res.status(500).json({ message: "Erro ao buscar evolução" });
  }
}

/**
 * Comissões do usuário logado
 * GET /commissions?month=YYYY-MM
 */
async function getMyCommissions(req, res) {
  try {
    const userId = req.user.userId;
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        message: "Parâmetro month é obrigatório no formato YYYY-MM",
      });
    }

    const periodMonth = `${month}-01`;

    const [rows] = await db.query(
      `SELECT 
         c.id,
         c.sale_id,
         c.base_amount,
         c.commission_rate,
         c.commission_amount,
         c.status,
         c.paid_at,
         s.created_at AS sale_date,
         s.total AS sale_total
       FROM commissions c
       INNER JOIN sales s ON c.sale_id = s.id
       WHERE c.salesperson_user_id = ?
         AND c.period_month = ?
       ORDER BY s.created_at DESC`,
      [userId, periodMonth]
    );

    const [summaryRows] = await db.query(
      `SELECT 
         SUM(commission_amount) AS total_commission,
         SUM(CASE WHEN status = 'PAID' THEN commission_amount ELSE 0 END) AS paid_commission,
         SUM(CASE WHEN status = 'PENDING' THEN commission_amount ELSE 0 END) AS pending_commission
       FROM commissions
       WHERE salesperson_user_id = ?
         AND period_month = ?`,
      [userId, periodMonth]
    );

    return res.json({
      month,
      commissions: rows,
      summary: summaryRows[0],
    });
  } catch (error) {
    console.error("Error getting commissions:", error);
    return res.status(500).json({ message: "Erro ao buscar comissões" });
  }
}

/**
 * Comissões por vendedor (admin)
 * GET /commissions/by-salesperson?month=YYYY-MM&salespersonId=?
 */
async function getCommissionsBySalesperson(req, res) {
  try {
    const { month, salespersonId } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        message: "Parâmetro month é obrigatório no formato YYYY-MM",
      });
    }

    const periodMonth = `${month}-01`;
    const whereParts = ["c.period_month = ?"];
    const params = [periodMonth];

    if (salespersonId) {
      whereParts.push("c.salesperson_user_id = ?");
      params.push(salespersonId);
    }

    const whereSql = `WHERE ${whereParts.join(" AND ")}`;

    const [rows] = await db.query(
      `SELECT 
         c.salesperson_user_id,
         u.name AS salesperson_name,
         u.email AS salesperson_email,
         COUNT(*) AS total_commissions,
         SUM(c.commission_amount) AS total_amount,
         SUM(CASE WHEN c.status = 'PAID' THEN c.commission_amount ELSE 0 END) AS paid_amount,
         SUM(CASE WHEN c.status = 'PENDING' THEN c.commission_amount ELSE 0 END) AS pending_amount
       FROM commissions c
       INNER JOIN users u ON c.salesperson_user_id = u.id
       ${whereSql}
       GROUP BY c.salesperson_user_id, u.name, u.email
       ORDER BY total_amount DESC`,
      params
    );

    return res.json({
      month,
      data: rows,
    });
  } catch (error) {
    console.error("Error getting commissions by salesperson:", error);
    return res.status(500).json({ message: "Erro ao buscar comissões por vendedor" });
  }
}

/**
 * Calcula comissão para uma venda específica
 * POST /commissions/calculate/:saleId
 */
async function calculateCommission(req, res) {
  try {
    const { saleId } = req.params;

    const result = await CommissionService.recalculateCommission(Number(saleId));

    return res.json({
      message: "Comissão calculada com sucesso",
      ...result,
    });
  } catch (error) {
    console.error("Error calculating commission:", error);
    if (error.message === 'Venda não encontrada') {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: "Erro ao calcular comissão" });
  }
}

export default {
  getMySalesMetrics: asyncHandler(getMySalesMetrics),
  getMySales: asyncHandler(getMySales),
  getMySalesEvolucao: asyncHandler(getMySalesEvolucao),
  getMyCommissions: asyncHandler(getMyCommissions),
  getCommissionsBySalesperson: asyncHandler(getCommissionsBySalesperson),
  calculateCommission: asyncHandler(calculateCommission),
};
