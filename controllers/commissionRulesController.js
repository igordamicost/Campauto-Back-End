import { z } from "zod";
import { db } from "../src/config/database.js";
import { masterOnly } from "../src/middlewares/masterOnly.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const createRuleSchema = z.object({
  rule_type: z.enum(['DEFAULT', 'BY_SALESPERSON', 'BY_PRODUCT', 'BY_CATEGORY']),
  salesperson_user_id: z.number().int().positive().nullable().optional(),
  product_id: z.number().int().positive().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  commission_rate: z.number().min(0).max(100),
  is_active: z.boolean().optional().default(true),
  priority: z.number().int().min(0).optional().default(0),
});

const updateRuleSchema = z.object({
  commission_rate: z.number().min(0).max(100).optional(),
  is_active: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
});

/**
 * Lista todas as regras de comissão
 */
async function listRules(req, res) {
  try {
    const { rule_type, is_active } = req.query;

    let where = [];
    let params = [];

    if (rule_type) {
      where.push("rule_type = ?");
      params.push(rule_type);
    }

    if (is_active !== undefined) {
      where.push("is_active = ?");
      params.push(is_active === 'true' ? 1 : 0);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT 
         cr.id,
         cr.rule_type,
         cr.salesperson_user_id,
         cr.product_id,
         cr.category,
         cr.commission_rate,
         cr.is_active,
         cr.priority,
         cr.created_at,
         cr.updated_at,
         u.name AS salesperson_name,
         p.descricao AS product_description
       FROM commission_rules cr
       LEFT JOIN users u ON cr.salesperson_user_id = u.id
       LEFT JOIN produtos p ON cr.product_id = p.id
       ${whereSql}
       ORDER BY cr.priority DESC, cr.id DESC`,
      params
    );

    return res.json({ data: rows });
  } catch (error) {
    console.error("Error listing commission rules:", error);
    return res.status(500).json({ message: "Erro ao listar regras de comissão" });
  }
}

/**
 * Busca regra por ID
 */
async function getRuleById(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT 
         cr.id,
         cr.rule_type,
         cr.salesperson_user_id,
         cr.product_id,
         cr.category,
         cr.commission_rate,
         cr.is_active,
         cr.priority,
         cr.created_by,
         cr.created_at,
         cr.updated_at,
         u.name AS salesperson_name,
         p.descricao AS product_description
       FROM commission_rules cr
       LEFT JOIN users u ON cr.salesperson_user_id = u.id
       LEFT JOIN produtos p ON cr.product_id = p.id
       WHERE cr.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Regra não encontrada" });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("Error getting commission rule:", error);
    return res.status(500).json({ message: "Erro ao buscar regra de comissão" });
  }
}

/**
 * Cria nova regra de comissão
 */
async function createRule(req, res) {
  try {
    const validation = createRuleSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const data = validation.data;
    const createdBy = req.user.userId;

    // Validações específicas por tipo
    if (data.rule_type === 'BY_SALESPERSON' && !data.salesperson_user_id) {
      return res.status(400).json({ message: "salesperson_user_id é obrigatório para regras BY_SALESPERSON" });
    }

    if (data.rule_type === 'BY_PRODUCT' && !data.product_id) {
      return res.status(400).json({ message: "product_id é obrigatório para regras BY_PRODUCT" });
    }

    if (data.rule_type === 'BY_CATEGORY' && !data.category) {
      return res.status(400).json({ message: "category é obrigatório para regras BY_CATEGORY" });
    }

    // Verificar se já existe regra similar
    let checkSql = "SELECT id FROM commission_rules WHERE rule_type = ?";
    const checkParams = [data.rule_type];

    if (data.rule_type === 'BY_SALESPERSON') {
      checkSql += " AND salesperson_user_id = ?";
      checkParams.push(data.salesperson_user_id);
    } else if (data.rule_type === 'BY_PRODUCT') {
      checkSql += " AND product_id = ?";
      checkParams.push(data.product_id);
    } else if (data.rule_type === 'BY_CATEGORY') {
      checkSql += " AND category = ?";
      checkParams.push(data.category);
    } else if (data.rule_type === 'DEFAULT') {
      checkSql += " AND salesperson_user_id IS NULL AND product_id IS NULL AND category IS NULL";
    }

    const [existing] = await db.query(checkSql, checkParams);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Já existe uma regra deste tipo com os mesmos parâmetros" });
    }

    // Criar regra
    const [result] = await db.query(
      `INSERT INTO commission_rules 
       (rule_type, salesperson_user_id, product_id, category, commission_rate, is_active, priority, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.rule_type,
        data.salesperson_user_id || null,
        data.product_id || null,
        data.category || null,
        data.commission_rate,
        data.is_active ? 1 : 0,
        data.priority || 0,
        createdBy,
      ]
    );

    const [newRule] = await db.query(
      `SELECT 
         cr.id,
         cr.rule_type,
         cr.salesperson_user_id,
         cr.product_id,
         cr.category,
         cr.commission_rate,
         cr.is_active,
         cr.priority,
         cr.created_at,
         cr.updated_at,
         u.name AS salesperson_name,
         p.descricao AS product_description
       FROM commission_rules cr
       LEFT JOIN users u ON cr.salesperson_user_id = u.id
       LEFT JOIN produtos p ON cr.product_id = p.id
       WHERE cr.id = ?`,
      [result.insertId]
    );

    return res.status(201).json(newRule[0]);
  } catch (error) {
    console.error("Error creating commission rule:", error);
    return res.status(500).json({ message: "Erro ao criar regra de comissão" });
  }
}

/**
 * Atualiza regra de comissão
 */
async function updateRule(req, res) {
  try {
    const { id } = req.params;
    const validation = updateRuleSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const data = validation.data;
    const updates = [];
    const params = [];

    if (data.commission_rate !== undefined) {
      updates.push("commission_rate = ?");
      params.push(data.commission_rate);
    }

    if (data.is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(data.is_active ? 1 : 0);
    }

    if (data.priority !== undefined) {
      updates.push("priority = ?");
      params.push(data.priority);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    params.push(id);

    const [result] = await db.query(
      `UPDATE commission_rules SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Regra não encontrada" });
    }

    const [updatedRule] = await db.query(
      `SELECT 
         cr.id,
         cr.rule_type,
         cr.salesperson_user_id,
         cr.product_id,
         cr.category,
         cr.commission_rate,
         cr.is_active,
         cr.priority,
         cr.created_at,
         cr.updated_at,
         u.name AS salesperson_name,
         p.descricao AS product_description
       FROM commission_rules cr
       LEFT JOIN users u ON cr.salesperson_user_id = u.id
       LEFT JOIN produtos p ON cr.product_id = p.id
       WHERE cr.id = ?`,
      [id]
    );

    return res.json(updatedRule[0]);
  } catch (error) {
    console.error("Error updating commission rule:", error);
    return res.status(500).json({ message: "Erro ao atualizar regra de comissão" });
  }
}

/**
 * Deleta regra de comissão
 */
async function deleteRule(req, res) {
  try {
    const { id } = req.params;

    const [result] = await db.query("DELETE FROM commission_rules WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Regra não encontrada" });
    }

    return res.json({ message: "Regra deletada com sucesso" });
  } catch (error) {
    console.error("Error deleting commission rule:", error);
    return res.status(500).json({ message: "Erro ao deletar regra de comissão" });
  }
}

export default {
  listRules: asyncHandler(listRules),
  getRuleById: asyncHandler(getRuleById),
  createRule: asyncHandler(createRule),
  updateRule: asyncHandler(updateRule),
  deleteRule: asyncHandler(deleteRule),
};
