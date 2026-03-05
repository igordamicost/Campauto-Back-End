import { SalesLogRepository } from "../src/repositories/salesLog.repository.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

async function list(req, res) {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      data_inicio: req.query.data_inicio,
      data_fim: req.query.data_fim,
      empresa_id: req.query.empresa_id,
      vendedor_id: req.query.vendedor_id,
      cliente_id: req.query.cliente_id,
      veiculo_id: req.query.veiculo_id,
      produto_id: req.query.produto_id,
      tipo: req.query.tipo,
      orcamento_id: req.query.orcamento_id,
    };
    const result = await SalesLogRepository.list(filters);
    return res.json(result);
  } catch (error) {
    console.error("Error listing sales log:", error);
    return res.status(500).json({ message: "Erro ao listar histórico de vendas" });
  }
}

export default {
  list: asyncHandler(list),
};
