/**
 * Job: Verifica se todas as empresas estão com dados fiscais e certificado preenchidos.
 * Executado apenas quando uma empresa é criada ou excluída.
 * Se alguma empresa estiver incompleta, notifica os gerentes (ADMIN/MASTER).
 */

import { getPool } from "../../db.js";
import { NotificationRepository } from "../repositories/notification.repository.js";

const NOTIFICATION_TYPE = "EMPRESA_FISCAL_INCOMPLETA";

/**
 * Verifica se uma empresa está com configuração fiscal completa.
 * Requer: token_focus, certificado_base64, cnpj e razao_social.
 */
function empresaEstaConforme(empresa, config) {
  if (!config) return false;
  const tokenOk = config.token_focus && String(config.token_focus).trim().length > 0;
  const certOk = config.certificado_base64 && String(config.certificado_base64).trim().length > 0;
  const cnpjOk = (config.cnpj || empresa?.cnpj) && String(config.cnpj || empresa?.cnpj || "").replace(/\D/g, "").length >= 14;
  const razaoOk = (empresa?.razao_social || empresa?.nome_fantasia) && String(empresa?.razao_social || empresa?.nome_fantasia || "").trim().length > 0;
  return tokenOk && certOk && cnpjOk && razaoOk;
}

/**
 * Executa a verificação de conformidade fiscal de todas as empresas.
 * Se alguma estiver incompleta, cria notificação para cada gerente (ADMIN/MASTER).
 * @returns {{ ok: boolean, incompletas: Array<{ id: number, nome: string }> }}
 */
export async function executarVerificacaoFiscalEmpresas() {
  const pool = getPool();

  const [empresasRows] = await pool.query(
    "SELECT id, nome_fantasia, razao_social, cnpj FROM empresas ORDER BY id"
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
    if (!empresaEstaConforme(emp, config)) {
      incompletas.push({
        id: emp.id,
        nome: emp.razao_social || emp.nome_fantasia || `Empresa #${emp.id}`,
      });
    }
  }

  if (incompletas.length === 0) {
    return { ok: true, incompletas: [] };
  }

  const managers = await NotificationRepository.getManagers();
  if (managers.length === 0) {
    return { ok: false, incompletas };
  }

  const nomesIncompletas = incompletas.map((e) => e.nome).join(", ");
  const title = "Configuração fiscal incompleta";
  const message =
    incompletas.length === 1
      ? `A empresa "${nomesIncompletas}" não possui todos os dados fiscais e certificado configurados. Acesse Configuração Fiscal e preencha token, certificado e dados obrigatórios.`
      : `${incompletas.length} empresas não possuem configuração fiscal completa: ${nomesIncompletas}. Acesse Configuração Fiscal e preencha token, certificado e dados obrigatórios para cada uma.`;

  for (const manager of managers) {
    await NotificationRepository.create({
      user_id: manager.id,
      type: NOTIFICATION_TYPE,
      title,
      message,
      metadata: { empresas_incompletas: incompletas },
    });
  }

  return { ok: false, incompletas };
}
