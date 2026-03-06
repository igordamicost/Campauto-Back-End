import { db } from "../config/database.js";

/**
 * Repositório para o módulo Vínculos (produtos e fábricas)
 */
export class VinculosRepository {
  /**
   * Lista vínculos entre produtos com paginação
   */
  static async listProdutoVinculos(filters = {}) {
    const { produto_id, limit = 50, offset = 0 } = filters;
    const whereParts = [];
    const params = [];

    if (produto_id != null) {
      whereParts.push("(pv.produto_id_origem = ? OR pv.produto_id_vinculado = ?)");
      params.push(Number(produto_id), Number(produto_id));
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT pv.id, pv.produto_id_origem, pv.produto_id_vinculado, pv.created_at,
              po.descricao AS origem_descricao, po.codigo_fabrica AS origem_codigo_fabrica,
              pv2.descricao AS vinculado_descricao, pv2.codigo_fabrica AS vinculado_codigo_fabrica
       FROM produto_vinculos pv
       LEFT JOIN produtos po ON po.id = pv.produto_id_origem
       LEFT JOIN produtos pv2 ON pv2.id = pv.produto_id_vinculado
       ${whereSql}
       ORDER BY pv.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM produto_vinculos pv ${whereSql}`,
      params
    );

    return { data: rows, total: countRow?.total ?? 0 };
  }

  /**
   * Cria vínculo entre dois produtos (bidirecional: armazena apenas A-B, não B-A)
   * Evita duplicatas: normaliza para menor id como origem
   */
  static async createProdutoVinculo(produto_id_origem, produto_id_vinculado) {
    const a = Number(produto_id_origem);
    const b = Number(produto_id_vinculado);
    if (a === b) return null;
    const [origem, vinculado] = a < b ? [a, b] : [b, a];

    const [result] = await db.query(
      `INSERT INTO produto_vinculos (produto_id_origem, produto_id_vinculado)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [origem, vinculado]
    );
    if (result.insertId) return result.insertId;
    const [existing] = await db.query(
      "SELECT id FROM produto_vinculos WHERE produto_id_origem = ? AND produto_id_vinculado = ?",
      [origem, vinculado]
    );
    return existing[0]?.id ?? null;
  }

  /**
   * Remove vínculo por id
   */
  static async deleteProdutoVinculo(id) {
    const [result] = await db.query("DELETE FROM produto_vinculos WHERE id = ?", [Number(id)]);
    return result.affectedRows > 0;
  }

  /**
   * Retorna o grupo de produtos similares (triangularização transitiva)
   * Usa BFS para encontrar todos os produtos conectados
   */
  static async getSimilaresByProdutoId(produtoId) {
    const pid = Number(produtoId);
    const visited = new Set([pid]);
    const queue = [pid];

    while (queue.length > 0) {
      const current = queue.shift();
      const [rows] = await db.query(
        `SELECT produto_id_origem, produto_id_vinculado FROM produto_vinculos
         WHERE produto_id_origem = ? OR produto_id_vinculado = ?`,
        [current, current]
      );
      for (const r of rows) {
        const other = r.produto_id_origem === current ? r.produto_id_vinculado : r.produto_id_origem;
        if (!visited.has(other)) {
          visited.add(other);
          queue.push(other);
        }
      }
    }

    const ids = Array.from(visited);
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => "?").join(",");
    const [produtos] = await db.query(
      `SELECT id, codigo_produto, codigo_fabrica, descricao, observacao
       FROM produtos WHERE id IN (${placeholders})
       ORDER BY descricao`,
      ids
    );
    return produtos;
  }

  /**
   * Lista fábricas com paginação e busca
   */
  static async listFabricas(filters = {}) {
    const { q, limit = 50, offset = 0 } = filters;
    const whereParts = [];
    const params = [];

    if (q && String(q).trim()) {
      const term = `%${String(q).trim()}%`;
      whereParts.push("(f.nome LIKE ? OR f.codigo LIKE ?)");
      params.push(term, term);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT f.id, f.nome, f.codigo, f.created_at, f.updated_at,
              (SELECT COUNT(*) FROM produto_fabrica pf WHERE pf.fabrica_id = f.id) AS produtos_count
       FROM fabricas f
       ${whereSql}
       ORDER BY f.nome
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM fabricas f ${whereSql}`,
      params
    );

    return { data: rows, total: countRow?.total ?? 0 };
  }

  /**
   * Busca fábrica por id
   */
  static async getFabricaById(id) {
    const [rows] = await db.query("SELECT * FROM fabricas WHERE id = ?", [Number(id)]);
    return rows[0] || null;
  }

  /**
   * Cria fábrica
   */
  static async createFabrica({ nome, codigo }) {
    const [result] = await db.query(
      "INSERT INTO fabricas (nome, codigo) VALUES (?, ?)",
      [String(nome || "").trim(), codigo ? String(codigo).trim() : null]
    );
    return result.insertId;
  }

  /**
   * Atualiza fábrica
   */
  static async updateFabrica(id, { nome, codigo }) {
    const updates = [];
    const params = [];
    if (nome !== undefined) {
      updates.push("nome = ?");
      params.push(String(nome).trim());
    }
    if (codigo !== undefined) {
      updates.push("codigo = ?");
      params.push(codigo ? String(codigo).trim() : null);
    }
    if (updates.length === 0) return false;
    params.push(Number(id));
    const [result] = await db.query(
      `UPDATE fabricas SET ${updates.join(", ")} WHERE id = ?`,
      params
    );
    return result.affectedRows > 0;
  }

  /**
   * Remove fábrica
   */
  static async deleteFabrica(id) {
    const [result] = await db.query("DELETE FROM fabricas WHERE id = ?", [Number(id)]);
    return result.affectedRows > 0;
  }

  /**
   * Lista produtos vinculados à fábrica
   */
  static async getProdutosByFabrica(fabricaId, limit = 200, offset = 0) {
    const [rows] = await db.query(
      `SELECT p.id, p.codigo_produto, p.codigo_fabrica, p.descricao, p.observacao, pf.created_at AS vinculado_em
       FROM produto_fabrica pf
       INNER JOIN produtos p ON p.id = pf.produto_id
       WHERE pf.fabrica_id = ?
       ORDER BY p.descricao
       LIMIT ? OFFSET ?`,
      [Number(fabricaId), Number(limit), Number(offset)]
    );

    const [[countRow]] = await db.query(
      "SELECT COUNT(*) AS total FROM produto_fabrica WHERE fabrica_id = ?",
      [Number(fabricaId)]
    );

    return { data: rows, total: countRow?.total ?? 0 };
  }

  /**
   * Vincula produtos à fábrica
   */
  static async vincularProdutos(fabricaId, produtoIds) {
    if (!Array.isArray(produtoIds) || produtoIds.length === 0) return 0;
    const fid = Number(fabricaId);
    let inserted = 0;
    for (const pid of produtoIds) {
      try {
        const [r] = await db.query(
          "INSERT IGNORE INTO produto_fabrica (produto_id, fabrica_id) VALUES (?, ?)",
          [Number(pid), fid]
        );
        if (r.affectedRows > 0) inserted++;
      } catch {}
    }
    return inserted;
  }

  /**
   * Desvincula produto da fábrica
   */
  static async desvincularProduto(fabricaId, produtoId) {
    const [result] = await db.query(
      "DELETE FROM produto_fabrica WHERE fabrica_id = ? AND produto_id = ?",
      [Number(fabricaId), Number(produtoId)]
    );
    return result.affectedRows > 0;
  }

  /**
   * Retorna IDs de produtos no grupo de vínculos (para integração com busca de estoque)
   */
  static async getProdutoIdsNoGrupo(produtoId) {
    const similares = await this.getSimilaresByProdutoId(produtoId);
    return similares.map((p) => p.id);
  }

  /**
   * Retorna IDs de produtos que têm codigo_fabrica = termo OU estão no grupo de algum produto com esse código
   */
  static async getProdutoIdsPorCodigoFabrica(termo) {
    const t = String(termo || "").trim();
    if (!t) return [];

    const [rows] = await db.query(
      "SELECT id FROM produtos WHERE codigo_fabrica LIKE ?",
      [`%${t}%`]
    );
    const ids = new Set(rows.map((r) => r.id));

    for (const r of rows) {
      const similares = await this.getSimilaresByProdutoId(r.id);
      similares.forEach((p) => ids.add(p.id));
    }
    return Array.from(ids);
  }
}
