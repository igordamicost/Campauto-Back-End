import { VinculosRepository } from "../src/repositories/vinculos.repository.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// --- Vínculos de Produtos ---

async function listProdutoVinculos(req, res) {
  try {
    const { page = 1, limit = 50, produto_id } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    const { data, total } = await VinculosRepository.listProdutoVinculos({
      produto_id: produto_id != null ? Number(produto_id) : undefined,
      limit: Number(limit) || 50,
      offset,
    });
    return res.json({ data, total, page: Number(page), perPage: Number(limit) });
  } catch (error) {
    console.error("[vinculos] listProdutoVinculos:", error);
    return res.status(500).json({ message: "Erro ao listar vínculos de produtos" });
  }
}

async function createProdutoVinculo(req, res) {
  try {
    const { produto_ids } = req.body;
    if (!Array.isArray(produto_ids) || produto_ids.length === 0) {
      return res.status(400).json({ message: "produto_ids (array) é obrigatório" });
    }
    const id = await VinculosRepository.createProdutoVinculo(produto_ids);
    if (!id) {
      return res.status(400).json({ message: "Não foi possível criar o grupo" });
    }
    return res.status(201).json({ id });
  } catch (error) {
    console.error("[vinculos] createProdutoVinculo:", error);
    return res.status(500).json({ message: "Erro ao criar vínculo" });
  }
}

async function deleteProdutoVinculo(req, res) {
  try {
    const ok = await VinculosRepository.deleteProdutoVinculo(req.params.id);
    if (!ok) return res.status(404).json({ message: "Vínculo não encontrado" });
    return res.json({ message: "Vínculo removido" });
  } catch (error) {
    console.error("[vinculos] deleteProdutoVinculo:", error);
    return res.status(500).json({ message: "Erro ao remover vínculo" });
  }
}

async function getSimilares(req, res) {
  try {
    const { produtoId } = req.params;
    const data = await VinculosRepository.getSimilaresByProdutoId(produtoId);
    return res.json({ data });
  } catch (error) {
    console.error("[vinculos] getSimilares:", error);
    return res.status(500).json({ message: "Erro ao buscar similares" });
  }
}

// --- Fábricas ---

async function listFabricas(req, res) {
  try {
    const { page = 1, limit = 50, q } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    const { data, total } = await VinculosRepository.listFabricas({
      q: q ? String(q).trim() || undefined : undefined,
      limit: Number(limit) || 50,
      offset,
    });
    return res.json({ data, total, page: Number(page), perPage: Number(limit) });
  } catch (error) {
    console.error("[vinculos] listFabricas:", error);
    return res.status(500).json({ message: "Erro ao listar fábricas" });
  }
}

async function getFabricaById(req, res) {
  try {
    const fabrica = await VinculosRepository.getFabricaById(req.params.id);
    if (!fabrica) return res.status(404).json({ message: "Fábrica não encontrada" });
    const { data: produtos } = await VinculosRepository.getProdutosByFabrica(req.params.id, 500, 0);
    return res.json({ ...fabrica, produtos: produtos });
  } catch (error) {
    console.error("[vinculos] getFabricaById:", error);
    return res.status(500).json({ message: "Erro ao buscar fábrica" });
  }
}

async function createFabrica(req, res) {
  try {
    const { nome, codigo } = req.body;
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ message: "nome é obrigatório" });
    }
    const id = await VinculosRepository.createFabrica({ nome: nome.trim(), codigo });
    return res.status(201).json({ id });
  } catch (error) {
    console.error("[vinculos] createFabrica:", error);
    return res.status(500).json({ message: "Erro ao criar fábrica" });
  }
}

async function updateFabrica(req, res) {
  try {
    const ok = await VinculosRepository.updateFabrica(req.params.id, req.body);
    if (!ok) return res.status(404).json({ message: "Fábrica não encontrada" });
    return res.json({ message: "Fábrica atualizada" });
  } catch (error) {
    console.error("[vinculos] updateFabrica:", error);
    return res.status(500).json({ message: "Erro ao atualizar fábrica" });
  }
}

async function deleteFabrica(req, res) {
  try {
    const ok = await VinculosRepository.deleteFabrica(req.params.id);
    if (!ok) return res.status(404).json({ message: "Fábrica não encontrada" });
    return res.json({ message: "Fábrica removida" });
  } catch (error) {
    console.error("[vinculos] deleteFabrica:", error);
    return res.status(500).json({ message: "Erro ao remover fábrica" });
  }
}

async function getFabricaProdutos(req, res) {
  try {
    const { page = 1, limit = 200 } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    const { data, total } = await VinculosRepository.getProdutosByFabrica(
      req.params.id,
      Number(limit) || 200,
      offset
    );
    return res.json({ data, total, page: Number(page), perPage: Number(limit) });
  } catch (error) {
    console.error("[vinculos] getFabricaProdutos:", error);
    return res.status(500).json({ message: "Erro ao listar produtos da fábrica" });
  }
}

async function vincularProdutos(req, res) {
  try {
    const { produto_ids } = req.body;
    if (!Array.isArray(produto_ids) || produto_ids.length === 0) {
      return res.status(400).json({ message: "produto_ids (array) é obrigatório" });
    }
    const inserted = await VinculosRepository.vincularProdutos(req.params.id, produto_ids);
    return res.status(201).json({ message: "Produtos vinculados", vinculados: inserted });
  } catch (error) {
    console.error("[vinculos] vincularProdutos:", error);
    return res.status(500).json({ message: "Erro ao vincular produtos" });
  }
}

async function desvincularProduto(req, res) {
  try {
    const ok = await VinculosRepository.desvincularProduto(
      req.params.id,
      req.params.produtoId
    );
    if (!ok) return res.status(404).json({ message: "Vínculo produto-fábrica não encontrado" });
    return res.json({ message: "Produto desvinculado" });
  } catch (error) {
    console.error("[vinculos] desvincularProduto:", error);
    return res.status(500).json({ message: "Erro ao desvincular produto" });
  }
}

export {
  listProdutoVinculos,
  createProdutoVinculo,
  deleteProdutoVinculo,
  getSimilares,
  listFabricas,
  getFabricaById,
  createFabrica,
  updateFabrica,
  deleteFabrica,
  getFabricaProdutos,
  vincularProdutos,
  desvincularProduto,
  asyncHandler,
};
