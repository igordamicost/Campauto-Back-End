/**
 * Oficina (ordens de serviço) - endpoints stub para integração com o front.
 * Status esperados: ABERTA, EM_ANDAMENTO, AGUARDANDO_PECAS, FINALIZADA, CANCELADA.
 * Implementação completa (tabelas OS, checklists) pode ser feita em módulo futuro.
 */

async function listOS(req, res) {
  const q = (req.query.q || "").trim();
  // Stub: retorna lista vazia até existir tabela de OS
  res.json({
    data: [],
    page: 1,
    perPage: Number(req.query.limit || req.query.perPage || 20),
    total: 0,
    totalPages: 0,
  });
}

async function getOSById(req, res) {
  res.status(404).json({ message: "Ordem de serviço não encontrada" });
}

async function getChecklists(req, res) {
  // Stub: retorna lista vazia até existir tabela de checklists por OS
  res.json({ data: [] });
}

export { listOS, getOSById, getChecklists };
