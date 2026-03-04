/**
 * Job: Verifica se todas as empresas estão com dados fiscais e certificado preenchidos.
 * Executado na inicialização do sistema e a cada hora.
 * Se alguma empresa estiver incompleta, notifica os gerentes (ADMIN/MASTER).
 * Evita notificações duplicadas: só cria nova se não houver uma nos últimos 23h.
 */

import { getPool } from "../../db.js";
import { NotificationRepository } from "../repositories/notification.repository.js";

const NOTIFICATION_TYPE = "EMPRESA_FISCAL_INCOMPLETA";
const CAMPOS_VERIFICADOS = {
  token_focus: "Token Focus",
  certificado_base64: "Certificado A1 (.pfx)",
  cnpj: "CNPJ",
  razao_social: "Razão social ou Nome fantasia",
  endereco: "Endereço",
  cidade: "Cidade",
  estado: "Estado (UF)",
  cep: "CEP",
  email: "E-mail",
  telefone: "Telefone",
};

/**
 * Verifica se uma empresa está com configuração fiscal completa.
 * Retorna array de campos faltantes (vazio se conforme).
 */
function obterCamposFaltantes(empresa, config) {
  const faltando = [];

  // Configuração fiscal (empresas_focus_config)
  if (!config?.token_focus || String(config.token_focus || "").trim().length === 0) {
    faltando.push("token_focus");
  }
  if (!config?.certificado_base64 || String(config.certificado_base64 || "").trim().length === 0) {
    faltando.push("certificado_base64");
  }

  const cnpj = (config?.cnpj || empresa?.cnpj || "").replace(/\D/g, "");
  if (cnpj.length < 14) {
    faltando.push("cnpj");
  }

  const razao = (empresa?.razao_social || empresa?.nome_fantasia || "").trim();
  if (razao.length === 0) {
    faltando.push("razao_social");
  }

  // Dados básicos da empresa (para nota fiscal correta)
  if (!(empresa?.endereco || "").trim()) {
    faltando.push("endereco");
  }
  if (!(empresa?.cidade || "").trim()) {
    faltando.push("cidade");
  }
  if (!(empresa?.estado || "").trim() || String(empresa?.estado || "").length < 2) {
    faltando.push("estado");
  }
  const cep = (empresa?.cep || "").replace(/\D/g, "");
  if (cep.length < 8) {
    faltando.push("cep");
  }
  if (!(empresa?.email || "").trim()) {
    faltando.push("email");
  }
  if (!(empresa?.telefone || "").trim()) {
    faltando.push("telefone");
  }

  return faltando;
}

/**
 * Verifica se já existe notificação recente (evitar spam a cada hora).
 */
async function notificacaoRecenteExiste() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT 1 FROM notifications
     WHERE type = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 23 HOUR)
     LIMIT 1`,
    [NOTIFICATION_TYPE]
  );
  return rows.length > 0;
}

/**
 * Executa a verificação de conformidade fiscal de todas as empresas.
 * Se alguma estiver incompleta, cria notificação para cada gerente (ADMIN/MASTER).
 * Não cria nova notificação se já existir uma nos últimos 23h.
 * @returns {{ ok: boolean, incompletas: Array<{ id: number, nome: string, faltando: string[] }> }}
 */
export async function executarVerificacaoFiscalEmpresas() {
  const pool = getPool();

  const [empresasRows] = await pool.query(
    `SELECT id, nome_fantasia, razao_social, cnpj, endereco, cep, cidade, estado, email, telefone
     FROM empresas ORDER BY id`
  );

  if (empresasRows.length === 0) {
    return { ok: true, incompletas: [] };
  }

  const [configsRows] = await pool.query(
    `SELECT empresa_id, token_focus, certificado_base64, cnpj
     FROM empresas_focus_config
     WHERE empresa_id IN (${empresasRows.map(() => "?").join(",")})`,
    empresasRows.map((e) => e.id)
  );

  const configByEmpresa = Object.fromEntries(
    configsRows.map((r) => [r.empresa_id, r])
  );

  const incompletas = [];

  for (const emp of empresasRows) {
    const config = configByEmpresa[emp.id];
    const faltando = obterCamposFaltantes(emp, config);
    if (faltando.length > 0) {
      incompletas.push({
        id: emp.id,
        nome: emp.razao_social || emp.nome_fantasia || `Empresa #${emp.id}`,
        faltando,
      });
    }
  }

  if (incompletas.length === 0) {
    return { ok: true, incompletas: [] };
  }

  // Evitar notificações duplicadas a cada hora
  if (await notificacaoRecenteExiste()) {
    return { ok: false, incompletas, notificacaoOmitida: true };
  }

  const managers = await NotificationRepository.getManagers();
  if (managers.length === 0) {
    return { ok: false, incompletas };
  }

  const nomesIncompletas = incompletas.map((e) => e.nome).join(", ");
  const detalhes = incompletas
    .map(
      (e) =>
        `• ${e.nome}: ${e.faltando.map((f) => CAMPOS_VERIFICADOS[f] || f).join(", ")}`
    )
    .join("\n");

  const title = "Configuração fiscal incompleta";
  const message =
    incompletas.length === 1
      ? `A empresa "${nomesIncompletas}" não possui todos os dados fiscais e certificado configurados.\n\nFaltando: ${incompletas[0].faltando.map((f) => CAMPOS_VERIFICADOS[f] || f).join(", ")}\n\nAcesse Configuração Fiscal e o cadastro da empresa para preencher.`
      : `${incompletas.length} empresas com configuração fiscal incompleta:\n\n${detalhes}\n\nAcesse Configuração Fiscal e o cadastro de cada empresa para preencher.`;

  for (const manager of managers) {
    await NotificationRepository.create({
      user_id: manager.id,
      type: NOTIFICATION_TYPE,
      title,
      message,
      metadata: {
        empresas_incompletas: incompletas.map((e) => ({
          id: e.id,
          nome: e.nome,
          faltando: e.faltando.map((f) => CAMPOS_VERIFICADOS[f] || f),
        })),
      },
    });
  }

  return { ok: false, incompletas };
}
