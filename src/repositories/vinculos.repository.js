import { db } from "../config/database.js";

/**
 * Repositório para o módulo Vínculos (grupos de produtos + fábricas)
 * Modelo: produto_vinculo_grupos + produto_vinculo_grupo_itens (um produto só pode estar em um grupo)
 */
export class VinculosRepository {
  /**
   * Lista grupos de vínculos com paginação
   * Cada grupo contém os produtos vinculados (mesma peça, fabricantes diferentes)
   */
  static async listProdutoVinculos(filters = {}) {
    const { produto_id, limit = 50, offset = 0 } = filters;
    let whereSql = "";
    const params = [];

    if (produto_id != null) {
      whereSql = `WHERE g.id IN (SELECT grupo_id FROM produto_vinculo_grupo_itens WHERE produto_id = ?)`;
      params.push(Number(produto_id));
    }

    const [rows] = await db.query(
      `SELECT g.id, g.created_at, g.updated_at
       FROM produto_vinculo_grupos g
       ${whereSql}
       ORDER BY g.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM produto_vinculo_grupos g ${whereSql}`,
      params
    );

    const grupoIds = rows.map((r) => r.id);
    let produtosByGrupo = new Map();
    if (grupoIds.length > 0) {
      const ph = grupoIds.map(() => "?").join(",");
      const [itens] = await db.query(
        `SELECT gi.grupo_id, p.id, p.codigo_produto, p.codigo_fabrica, p.descricao
         FROM produto_vinculo_grupo_itens gi
         INNER JOIN produtos p ON p.id = gi.produto_id
         WHERE gi.grupo_id IN (${ph})
         ORDER BY gi.grupo_id, p.descricao`,
        grupoIds
      );
      for (const it of itens) {
        if (!produtosByGrupo.has(it.grupo_id)) produtosByGrupo.set(it.grupo_id, []);
        produtosByGrupo.get(it.grupo_id).push({
          id: it.id,
          codigo_produto: it.codigo_produto,
          codigo_fabrica: it.codigo_fabrica,
          descricao: it.descricao,
        });
      }
    }

    const data = rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      updated_at: r.updated_at,
      produtos: produtosByGrupo.get(r.id) || [],
    }));

    return { data, total: countRow?.total ?? 0 };
  }

  /**
   * Cria grupo com vários produtos. Body: { produto_ids: [1, 2, 3, 4, 5] }
   * Produtos que já estão em outro grupo são removidos do grupo antigo e adicionados ao novo.
   */
  static async createProdutoVinculo(produtoIds) {
    if (!Array.isArray(produtoIds) || produtoIds.length === 0) return null;
    const ids = [...new Set(produtoIds.map((id) => Number(id)).filter((id) => id > 0))];
    if (ids.length === 0) return null;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const placeholders = ids.map(() => "?").join(",");
      await connection.query(`DELETE FROM produto_vinculo_grupo_itens WHERE produto_id IN (${placeholders})`, ids);
      const [result] = await connection.query("INSERT INTO produto_vinculo_grupos () VALUES ()");
      const grupoId = result.insertId;
      for (const pid of ids) {
        await connection.query(
          "INSERT INTO produto_vinculo_grupo_itens (grupo_id, produto_id) VALUES (?, ?)",
          [grupoId, pid]
        );
      }
      await connection.commit();
      return grupoId;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Remove grupo (e todos os itens) por id
   */
  static async deleteProdutoVinculo(id) {
    const [result] = await db.query("DELETE FROM produto_vinculo_grupos WHERE id = ?", [Number(id)]);
    return result.affectedRows > 0;
  }

  /**
   * Retorna produtos similares (grupo triangular) do produto
   * Resposta: { data: [{ id, codigo_produto, codigo_fabrica, descricao, ... }] }
   */
  static async getSimilaresByProdutoId(produtoId) {
    const pid = Number(produtoId);
    const [grupoRows] = await db.query(
      `SELECT grupo_id FROM produto_vinculo_grupo_itens WHERE produto_id = ?`,
      [pid]
    );
    if (!grupoRows || grupoRows.length === 0) return [];

    const grupoId = grupoRows[0].grupo_id;
    const [produtos] = await db.query(
      `SELECT p.id, p.codigo_produto, p.codigo_fabrica, p.descricao, p.observacao
       FROM produto_vinculo_grupo_itens gi
       INNER JOIN produtos p ON p.id = gi.produto_id
       WHERE gi.grupo_id = ?
       ORDER BY p.descricao`,
      [grupoId]
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

  // --- Kits ---

  /**
   * Lista kits com paginação e busca por nome
   */
  static async listKits(filters = {}) {
    const { q, limit = 50, offset = 0 } = filters;
    const whereParts = [];
    const params = [];

    if (q && String(q).trim()) {
      whereParts.push("k.nome LIKE ?");
      params.push(`%${String(q).trim()}%`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT k.id, k.nome, k.created_at, k.updated_at,
              (SELECT COUNT(*) FROM kit_itens ki WHERE ki.kit_id = k.id) AS produtos_count
       FROM kits k
       ${whereSql}
       ORDER BY k.nome
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM kits k ${whereSql}`,
      params
    );

    return { data: rows, total: countRow?.total ?? 0 };
  }

  /**
   * Busca kit por id
   */
  static async getKitById(id) {
    const [rows] = await db.query("SELECT * FROM kits WHERE id = ?", [Number(id)]);
    return rows[0] || null;
  }

  /**
   * Cria kit com nome e lista de produtos
   * produto_ids pode ser array de ids ou array de { produto_id, quantidade?, ordem? }
   */
  static async createKit({ nome, produto_ids }) {
    const nomeStr = String(nome || "").trim();
    if (!nomeStr) return null;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query("INSERT INTO kits (nome) VALUES (?)", [nomeStr]);
      const kitId = result.insertId;

      const items = Array.isArray(produto_ids) ? produto_ids : [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const pid = typeof it === "object" ? Number(it?.produto_id ?? it?.produtoId) : Number(it);
        const qty = typeof it === "object" ? parseFloat(it?.quantidade ?? it?.qty ?? 1) : 1;
        if (pid > 0) {
          await connection.query(
            "INSERT INTO kit_itens (kit_id, produto_id, quantidade, ordem) VALUES (?, ?, ?, ?)",
            [kitId, pid, qty, i]
          );
        }
      }
      await connection.commit();
      return kitId;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Atualiza kit (nome e/ou produto_ids)
   */
  static async updateKit(id, { nome, produto_ids }) {
    const kitId = Number(id);
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      if (nome !== undefined) {
        await connection.query("UPDATE kits SET nome = ? WHERE id = ?", [String(nome).trim(), kitId]);
      }
      if (produto_ids !== undefined) {
        await connection.query("DELETE FROM kit_itens WHERE kit_id = ?", [kitId]);
        const items = Array.isArray(produto_ids) ? produto_ids : [];
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const pid = typeof it === "object" ? Number(it?.produto_id ?? it?.produtoId) : Number(it);
          const qty = typeof it === "object" ? parseFloat(it?.quantidade ?? it?.qty ?? 1) : 1;
          if (pid > 0) {
            await connection.query(
              "INSERT INTO kit_itens (kit_id, produto_id, quantidade, ordem) VALUES (?, ?, ?, ?)",
              [kitId, pid, qty, i]
            );
          }
        }
      }
      await connection.commit();
      return true;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Remove kit
   */
  static async deleteKit(id) {
    const [result] = await db.query("DELETE FROM kits WHERE id = ?", [Number(id)]);
    return result.affectedRows > 0;
  }

  /**
   * Lista produtos do kit com objeto produto completo (para orçamento)
   * Resposta: { data: [{ id, kit_id, produto_id, quantidade, ordem, produto: {...} }] }
   */
  static async getKitProdutos(kitId) {
    const [rows] = await db.query(
      `SELECT ki.id, ki.kit_id, ki.produto_id, ki.quantidade, ki.ordem,
              p.id AS p_id, p.codigo_produto, p.codigo_fabrica, p.descricao, p.observacao,
              p.preco_custo, p.unidade
       FROM kit_itens ki
       INNER JOIN produtos p ON p.id = ki.produto_id
       WHERE ki.kit_id = ?
       ORDER BY ki.ordem, ki.id`,
      [Number(kitId)]
    );

    return rows.map((r) => ({
      id: r.id,
      kit_id: r.kit_id,
      produto_id: r.produto_id,
      quantidade: parseFloat(r.quantidade) || 1,
      ordem: r.ordem ?? 0,
      produto: {
        id: r.produto_id,
        codigo_produto: r.codigo_produto,
        codigo_fabrica: r.codigo_fabrica,
        descricao: r.descricao,
        observacao: r.observacao,
        valor_unitario: r.preco_custo != null ? parseFloat(r.preco_custo) : null,
        preco_custo: r.preco_custo != null ? parseFloat(r.preco_custo) : null,
        unidade: r.unidade || "UN",
      },
    }));
  }
}
