/**
 * Fiscal / Contábil - exportações (sem NF-e).
 * GET /fiscal/exportacoes - stub; integração NF-e à parte.
 */
async function listExportacoes(req, res) {
  res.json({
    data: [],
    page: 1,
    perPage: Number(req.query.limit || req.query.perPage || 20),
    total: 0,
    totalPages: 0,
  });
}

export { listExportacoes };
