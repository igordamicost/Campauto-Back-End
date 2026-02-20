import { db } from "../config/database.js";

/**
 * Serviço para cálculo e gerenciamento de comissões
 */
export class CommissionService {
  /**
   * Busca a taxa de comissão aplicável para uma venda
   * Prioridade: BY_PRODUCT > BY_CATEGORY > BY_SALESPERSON > DEFAULT
   */
  static async getCommissionRate(salespersonUserId, productId = null, productCategory = null) {
    const connection = await db.getConnection();
    try {
      // Buscar regras ativas ordenadas por prioridade (maior primeiro)
      const [rules] = await connection.query(
        `SELECT rule_type, commission_rate, priority
         FROM commission_rules
         WHERE is_active = 1
         ORDER BY priority DESC, id DESC`
      );

      // Tentar encontrar regra mais específica primeiro
      for (const rule of rules) {
        switch (rule.rule_type) {
          case 'BY_PRODUCT':
            if (productId && rule.product_id === productId) {
              return Number(rule.commission_rate);
            }
            break;
          case 'BY_CATEGORY':
            if (productCategory && rule.category === productCategory) {
              return Number(rule.commission_rate);
            }
            break;
          case 'BY_SALESPERSON':
            if (rule.salesperson_user_id === salespersonUserId) {
              return Number(rule.commission_rate);
            }
            break;
          case 'DEFAULT':
            return Number(rule.commission_rate);
        }
      }

      // Se não encontrou nenhuma regra, retorna 0%
      return 0.00;
    } finally {
      connection.release();
    }
  }

  /**
   * Calcula e cria comissão para uma venda
   */
  static async calculateAndCreateCommission(saleId, salespersonUserId, baseAmount, productId = null, productCategory = null) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Buscar taxa de comissão
      const commissionRate = await this.getCommissionRate(salespersonUserId, productId, productCategory);
      
      // Calcular valor da comissão
      const commissionAmount = (baseAmount * commissionRate) / 100;

      // Determinar mês de referência
      const [saleRows] = await connection.query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-01') AS period_month FROM sales WHERE id = ?`,
        [saleId]
      );
      const periodMonth = saleRows[0]?.period_month || null;

      // Criar registro de comissão
      const [result] = await connection.query(
        `INSERT INTO commissions 
         (sale_id, salesperson_user_id, base_amount, commission_rate, commission_amount, period_month, status)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
         ON DUPLICATE KEY UPDATE
           base_amount = VALUES(base_amount),
           commission_rate = VALUES(commission_rate),
           commission_amount = VALUES(commission_amount),
           period_month = VALUES(period_month),
           updated_at = NOW()`,
        [saleId, salespersonUserId, baseAmount, commissionRate, commissionAmount, periodMonth]
      );

      await connection.commit();

      return {
        commissionId: result.insertId || null,
        commissionRate,
        commissionAmount,
        baseAmount,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Recalcula comissão para uma venda existente
   */
  static async recalculateCommission(saleId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Buscar dados da venda
      const [saleRows] = await connection.query(
        `SELECT s.id, s.salesperson_user_id, s.total, si.product_id, p.nome_grupo AS category
         FROM sales s
         LEFT JOIN sale_items si ON s.id = si.sale_id
         LEFT JOIN produtos p ON si.product_id = p.id
         WHERE s.id = ?
         LIMIT 1`,
        [saleId]
      );

      if (saleRows.length === 0) {
        throw new Error('Venda não encontrada');
      }

      const sale = saleRows[0];
      const baseAmount = Number(sale.total) || 0;

      // Buscar taxa de comissão
      const commissionRate = await this.getCommissionRate(
        sale.salesperson_user_id,
        sale.product_id,
        sale.category
      );

      // Calcular valor da comissão
      const commissionAmount = (baseAmount * commissionRate) / 100;

      // Determinar mês de referência
      const [periodRows] = await connection.query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-01') AS period_month FROM sales WHERE id = ?`,
        [saleId]
      );
      const periodMonth = periodRows[0]?.period_month || null;

      // Atualizar ou criar comissão
      await connection.query(
        `INSERT INTO commissions 
         (sale_id, salesperson_user_id, base_amount, commission_rate, commission_amount, period_month, status)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
         ON DUPLICATE KEY UPDATE
           base_amount = VALUES(base_amount),
           commission_rate = VALUES(commission_rate),
           commission_amount = VALUES(commission_amount),
           period_month = VALUES(period_month),
           updated_at = NOW()`,
        [saleId, sale.salesperson_user_id, baseAmount, commissionRate, commissionAmount, periodMonth]
      );

      await connection.commit();

      return {
        commissionRate,
        commissionAmount,
        baseAmount,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
