import { getPool } from "../db.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MESES_NOME = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function isValidDate(str) {
  if (!str || typeof str !== "string") return false;
  if (!DATE_REGEX.test(str)) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

function totalOrcamento(orcamento) {
  const itens = orcamento?.json_itens;
  if (!Array.isArray(itens)) return 0;
  return itens.reduce((sum, i) => sum + (Number(i?.total) || 0), 0);
}

function buildAgregacoes(data, dataFim, dataInicio) {
  const now = new Date();
  const anoRef = dataFim
    ? new Date(dataFim + "T12:00:00").getFullYear()
    : now.getFullYear();
  const mesRef = dataFim
    ? new Date(dataFim + "T12:00:00").getMonth()
    : now.getMonth();

  const comparativoMap = new Map();
  for (let m = 0; m < 12; m++) {
    comparativoMap.set(m, { total: 0, quantidade: 0 });
  }

  const evolucaoMap = new Map();
  const ultimoDia = new Date(anoRef, mesRef + 1, 0).getDate();
  for (let d = 1; d <= ultimoDia; d++) {
    evolucaoMap.set(d, { total: 0, quantidade: 0 });
  }

  let totalAno = 0;
  let totalMes = 0;
  let quantidadeMes = 0;

  for (const o of data) {
    const total = Math.round(totalOrcamento(o) * 100) / 100;
    const dataParts = (o.data || "").split("-").map(Number);
    if (dataParts.length !== 3) continue;

    const [ano, mes, dia] = dataParts;
    const mesJs = mes - 1;

    if (ano === anoRef) {
      const cm = comparativoMap.get(mesJs) || { total: 0, quantidade: 0 };
      cm.total += total;
      cm.quantidade += 1;
      comparativoMap.set(mesJs, cm);
      totalAno += total;

      if (mesJs === mesRef) {
        totalMes += total;
        quantidadeMes += 1;
        const ed = evolucaoMap.get(dia) || { total: 0, quantidade: 0 };
        ed.total += total;
        ed.quantidade += 1;
        evolucaoMap.set(dia, ed);
      }
    }
  }

  const comparativo_mensal = [];
  for (let m = 0; m < 12; m++) {
    const cm = comparativoMap.get(m) || { total: 0, quantidade: 0 };
    comparativo_mensal.push({
      mes: m,
      mes_nome: MESES_NOME[m],
      ano: anoRef,
      total: Math.round(cm.total * 100) / 100,
      quantidade: cm.quantidade,
    });
  }

  const evolucao_diaria = [];
  for (let d = 1; d <= ultimoDia; d++) {
    const ed = evolucaoMap.get(d) || { total: 0, quantidade: 0 };
    const dataStr = `${anoRef}-${String(mesRef + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    evolucao_diaria.push({
      dia: d,
      mes: mesRef,
      ano: anoRef,
      data: dataStr,
      total: Math.round(ed.total * 100) / 100,
      quantidade: ed.quantidade,
    });
  }

  const kpis = {
    total_mes_atual: Math.round(totalMes * 100) / 100,
    total_ano_atual: Math.round(totalAno * 100) / 100,
    ticket_medio_mes_atual: quantidadeMes > 0 ? Math.round((totalMes / quantidadeMes) * 100) / 100 : 0,
    quantidade_mes_atual: quantidadeMes,
    mes_atual: mesRef,
    ano_atual: anoRef,
  };

  return { comparativo_mensal, evolucao_diaria, kpis };
}

function normalizeJsonItens(jsonItens) {
  if (jsonItens === undefined || jsonItens === null || jsonItens === "") {
    return [];
  }
  let arr = jsonItens;
  if (typeof jsonItens === "string") {
    try {
      arr = JSON.parse(jsonItens);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];

  return arr.map((item, idx) => {
    const qty = Number(item?.quantidade) || 0;
    const unit = Number(item?.valor_unitario) || 0;
    const total = Number(item?.total) ?? qty * unit;

    return {
      id: Number(item?.id) || idx + 1,
      produto_id: Number(item?.produto_id) || 0,
      quantidade: qty,
      valor_unitario: unit,
      total: Math.round(total * 100) / 100,
    };
  });
}

async function orcamentos(req, res) {
  const { data_inicio, data_fim, status, include } = req.query;

  if (data_inicio && !isValidDate(data_inicio)) {
    return res.status(400).json({
      message: "Formato de data inválido. Use YYYY-MM-DD",
      field: "data_inicio",
    });
  }
  if (data_fim && !isValidDate(data_fim)) {
    return res.status(400).json({
      message: "Formato de data inválido. Use YYYY-MM-DD",
      field: "data_fim",
    });
  }

  const role = String(req.user?.role || "").toUpperCase();
  const roleId = req.user?.roleId;
  const isMaster = role === "MASTER" || roleId === 1;

  const pool = getPool();
  const where = [];
  const params = [];

  if (data_inicio) {
    where.push("o.data >= ?");
    params.push(data_inicio);
  }
  if (data_fim) {
    where.push("o.data <= ?");
    params.push(data_fim);
  }
  if (status) {
    where.push("o.status = ?");
    params.push(status);
  }

  if (!isMaster && req.user?.userId) {
    where.push("o.usuario_id = ?");
    params.push(req.user.userId);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      o.id,
      o.numero_sequencial,
      o.data,
      o.status,
      o.json_itens,
      o.usuario_id,
      o.empresa_id,
      c.id AS cliente_id,
      c.cliente AS cliente_nome,
      c.fantasia AS cliente_fantasia,
      c.razao_social AS cliente_empresa
    FROM orcamentos o
    LEFT JOIN clientes c ON o.cliente_id = c.id
    ${whereSql}
    ORDER BY o.data DESC, o.numero_sequencial DESC
  `;

  let rows;
  try {
    [rows] = await pool.query(sql, params);
  } catch (err) {
    console.error("Relatório orçamentos:", err);
    return res.status(500).json({ message: "Erro ao processar relatório" });
  }

  const includeList = include ? String(include).split(",").map((s) => s.trim()) : [];
  const includeResponsavel = includeList.includes("responsavel") || includeList.includes("usuario") || includeList.includes("usuarios");
  const includeEmpresas = includeList.includes("empresas");

  const data = rows.map((row) => {
    const jsonItens = normalizeJsonItens(row.json_itens);
    const dataStr =
      row.data instanceof Date
        ? row.data.toISOString().slice(0, 10)
        : String(row.data || "").slice(0, 10);

    const item = {
      id: row.id,
      numero_sequencial: row.numero_sequencial,
      data: dataStr,
      status: row.status || "Cotação",
      json_itens: jsonItens,
      usuario_id: row.usuario_id || null,
      empresa_id: row.empresa_id || null,
    };

    if (row.cliente_id) {
      item.clientes = {
        id: row.cliente_id,
        nome: row.cliente_nome || null,
        fantasia: row.cliente_fantasia || null,
        empresa: row.cliente_empresa || null,
      };
    } else {
      item.clientes = null;
    }

    return item;
  });

  if (includeResponsavel) {
    const usuarioIds = [...new Set(data.map((row) => row.usuario_id).filter(Boolean))];
    if (usuarioIds.length > 0) {
      const [userRows] = await pool.query(
        `SELECT id, name, email, role FROM users WHERE id IN (${usuarioIds
          .map(() => "?")
          .join(",")})`,
        usuarioIds
      );
      const userMap = new Map(
        userRows.map((u) => [
          u.id,
          {
            id: u.id,
            name: u.name,
            nome: u.name,
            email: u.email,
            role: u.role,
          },
        ])
      );
      data.forEach((item) => {
        item.responsavel = item.usuario_id ? (userMap.get(item.usuario_id) || null) : null;
      });
    } else {
      data.forEach((item) => {
        item.responsavel = null;
      });
    }
  }

  if (includeEmpresas) {
    const empresaIds = [...new Set(data.map((row) => row.empresa_id).filter(Boolean))];
    if (empresaIds.length > 0) {
      const [empresaRows] = await pool.query(
        `SELECT id, nome_fantasia, razao_social, cnpj FROM empresas WHERE id IN (${empresaIds
          .map(() => "?")
          .join(",")})`,
        empresaIds
      );
      const empresaMap = new Map(empresaRows.map((e) => [e.id, e]));
      data.forEach((item) => {
        item.empresas = item.empresa_id ? (empresaMap.get(item.empresa_id) || null) : null;
      });
    } else {
      data.forEach((item) => {
        item.empresas = null;
      });
    }
  }

  const agregacoes = buildAgregacoes(data, data_fim, data_inicio);

  res.json({ data, agregacoes });
}

export { orcamentos };
