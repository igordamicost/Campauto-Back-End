/**
 * Repositório para cache de notas fiscais Focus NFe.
 * Regra crucial: antes de buscar nfes_recebidas via API, verificar se já existe por chave_nfe.
 */

import { db } from "../config/database.js";

export class FocusNfRepository {
  /**
   * Verifica se nota já existe no banco por chave_nfe.
   */
  static async existePorChave(chaveNfe) {
    const chave = String(chaveNfe || "").trim();
    if (!chave || chave.length !== 44) return false;
    const [[row]] = await db.query(
      "SELECT 1 FROM focus_nf WHERE chave_nfe = ? LIMIT 1",
      [chave]
    );
    return !!row;
  }

  /**
   * Retorna última versão conhecida para nfes_recebidas (por empresa ou config).
   */
  static async getUltimaVersaoRecebidas(empresaId) {
    const [cfg] = await db.query(
      "SELECT ultima_versao_recebidas FROM empresas_focus_config WHERE empresa_id = ? LIMIT 1",
      [empresaId]
    );
    if (cfg[0]?.ultima_versao_recebidas != null) {
      return cfg[0].ultima_versao_recebidas;
    }
    const [max] = await db.query(
      "SELECT MAX(versao) AS v FROM focus_nf WHERE tipo = 'NFe_Recebida' AND empresa_id = ?",
      [empresaId]
    );
    return max[0]?.v ?? null;
  }

  /**
   * Atualiza última versão conhecida em empresas_focus_config.
   */
  static async setUltimaVersaoRecebidas(empresaId, versao) {
    await db.query(
      `INSERT INTO empresas_focus_config (empresa_id, ultima_versao_recebidas)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE ultima_versao_recebidas = ?`,
      [empresaId, versao, versao]
    );
  }

  /**
   * Insere ou atualiza nota no cache.
   */
  static async upsertNota(data) {
    const {
      tipo,
      chave_nfe,
      referencia,
      empresa_id,
      status,
      versao,
      cnpj_destinatario,
      numero,
      serie,
      data_emissao,
      valor_total,
      json_dados,
      pedido_compra_id,
      caminho_xml_nota_fiscal,
    } = data;

    if (chave_nfe) {
      const [existing] = await db.query(
        "SELECT id FROM focus_nf WHERE chave_nfe = ? LIMIT 1",
        [chave_nfe]
      );
      if (existing[0]) {
        await db.query(
          `UPDATE focus_nf SET status = ?, json_dados = ?, pedido_compra_id = COALESCE(?, pedido_compra_id),
            caminho_xml_nota_fiscal = COALESCE(?, caminho_xml_nota_fiscal), updated_at = NOW()
           WHERE chave_nfe = ?`,
          [status ?? existing[0].status, json_dados ? JSON.stringify(json_dados) : null, pedido_compra_id, caminho_xml_nota_fiscal || null, chave_nfe]
        );
        return existing[0].id;
      }
    }

    if (referencia) {
      const [existing] = await db.query(
        "SELECT id FROM focus_nf WHERE referencia = ? LIMIT 1",
        [referencia]
      );
      if (existing[0]) {
        const caminhoXml = data.caminho_xml_nota_fiscal;
        await db.query(
          `UPDATE focus_nf SET chave_nfe = COALESCE(?, chave_nfe), status = ?, json_dados = ?,
            caminho_xml_nota_fiscal = COALESCE(?, caminho_xml_nota_fiscal), updated_at = NOW()
           WHERE referencia = ?`,
          [chave_nfe, status, json_dados ? JSON.stringify(json_dados) : null, caminho_xml_nota_fiscal || null, referencia]
        );
        return existing[0].id;
      }
    }

    const [result] = await db.query(
      `INSERT INTO focus_nf (tipo, chave_nfe, referencia, empresa_id, status, versao, cnpj_destinatario, numero, serie, data_emissao, valor_total, json_dados, pedido_compra_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tipo,
        chave_nfe || null,
        referencia || null,
        empresa_id || null,
        status || null,
        versao ?? null,
        cnpj_destinatario || null,
        numero || null,
        serie || null,
        data_emissao || null,
        valor_total ?? null,
        json_dados ? JSON.stringify(json_dados) : null,
        pedido_compra_id ?? null,
      ]
    );
    return result.insertId;
  }

  /**
   * Insere itens da nota para entrada de estoque.
   */
  static async inserirItens(focusNfId, itens) {
    if (!Array.isArray(itens) || itens.length === 0) return [];
    const inserted = [];
    for (const it of itens) {
      const codigo = it.codigo_produto ?? it.cProd ?? it.codigoProduto ?? it.codigo;
      const qtd = parseFloat(it.quantidade_comercial ?? it.quantidade ?? it.qCom ?? it.qtd ?? 1) || 1;
      const [r] = await db.query(
        `INSERT INTO focus_nf_itens (focus_nf_id, numero_item, codigo_produto, descricao, quantidade, valor_unitario)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          focusNfId,
          it.numero_item ?? inserted.length + 1,
          codigo ? String(codigo).trim() : null,
          it.descricao || null,
          qtd,
          parseFloat(it.valor_unitario_comercial ?? it.valor_unitario ?? 0) || null,
        ]
      );
      inserted.push({ id: r.insertId, codigo_produto: codigo, quantidade: qtd });
    }
    return inserted;
  }

  /**
   * Busca nota por id, referencia ou chave.
   */
  static async findById(id) {
    const [rows] = await db.query("SELECT * FROM focus_nf WHERE id = ?", [id]);
    return rows[0] || null;
  }

  static async findByReferencia(referencia) {
    const [rows] = await db.query("SELECT * FROM focus_nf WHERE referencia = ?", [referencia]);
    return rows[0] || null;
  }

  static async findByChave(chaveNfe) {
    const [rows] = await db.query("SELECT * FROM focus_nf WHERE chave_nfe = ?", [chaveNfe]);
    return rows[0] || null;
  }

  /**
   * Lista itens de uma nota.
   */
  static async getItens(focusNfId) {
    const [rows] = await db.query(
      "SELECT * FROM focus_nf_itens WHERE focus_nf_id = ? ORDER BY numero_item",
      [focusNfId]
    );
    return rows;
  }

  /**
   * Obtém token da empresa (empresas_focus_config).
   * Configuração via sistema, não .env (preparado para SaaS).
   */
  static async getTokenEmpresa(empresaId) {
    const cfg = await FocusNfRepository.getConfigEmpresa(empresaId);
    return cfg?.token_focus || null;
  }

  /**
   * Obtém configuração Focus da empresa (token, ambiente, webhook_secret).
   */
  static async getConfigEmpresa(empresaId) {
    const [rows] = await db.query(
      "SELECT token_focus, ambiente, webhook_secret FROM empresas_focus_config WHERE empresa_id = ? LIMIT 1",
      [empresaId]
    );
    return rows[0] || null;
  }

  /**
   * Obtém CNPJ da empresa.
   */
  static async getCnpjEmpresa(empresaId) {
    const [rows] = await db.query(
      "SELECT cnpj FROM empresas WHERE id = ? LIMIT 1",
      [empresaId]
    );
    let cnpj = rows[0]?.cnpj;
    if (!cnpj) {
      const [cfg] = await db.query(
        "SELECT cnpj FROM empresas_focus_config WHERE empresa_id = ? LIMIT 1",
        [empresaId]
      );
      cnpj = cfg[0]?.cnpj;
    }
    return cnpj ? String(cnpj).replace(/\D/g, "") : null;
  }

  /**
   * Vincula nota recebida a pedido de compra.
   */
  static async vincularPedidoCompra(focusNfId, pedidoCompraId) {
    await db.query(
      "UPDATE focus_nf SET pedido_compra_id = ? WHERE id = ?",
      [pedidoCompraId, focusNfId]
    );
  }
}
