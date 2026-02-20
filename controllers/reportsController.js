import { db } from "../src/config/database.js";
import { CommissionService } from "../src/services/commissionService.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Relatório de vendas do usuário logado
 * GET /reports/my-sales?month=YYYY-MM
 */
async function getMySales(req, res) {
  try {
    const userId = req.user.userId;
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        message: "Parâmetro month é obrigatório no formato YYYY-MM",
      });
    }

    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    // Total vendido
    const [totalRows] = await db.query(
      `SELECT 
         COUNT(*) AS total_sales,
         COALESCE(SUM(total), 0) AS total_amount,
         COALESCE(AVG(total), 0) AS average_ticket
       FROM sales
       WHERE salesperson_user_id = ?
         AND DATE(created_at) >= ?
         AND DATE(created_at) <= ?
         AND status != 'CANCELED'`,
      [userId, startDate, endDate]
    );

    const stats = totalRows[0];

    // Vendas por dia
    const [dailyRows] = await db.query(
      `SELECT 
         DATE(created_at) AS date,
         COUNT(*) AS count,
         SUM(total) AS amount
       FROM sales
       WHERE salesperson_user_id = ?
         AND DATE(created_at) >= ?
         AND DATE(created_at) <= ?
         AND status != 'CANCELED'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [userId, startDate, endDate]
    );

    return res.json({
      month,
      total_sales: Number(stats.total_sales),
      total_amount: Number(stats.total_amount),
      average_ticket: Number(stats.average_ticket),
      daily_breakdown: dailyRows,
    });
  } catch (error) {
    console.error("Error getting my sales:", error);
    return res.status(500).json({ message: "Erro ao buscar vendas" });
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
  getMySales: asyncHandler(getMySales),
  getMyCommissions: asyncHandler(getMyCommissions),
  getCommissionsBySalesperson: asyncHandler(getCommissionsBySalesperson),
  calculateCommission: asyncHandler(calculateCommission),
};
