/**
 * Scheduler do job de verificação fiscal de empresas.
 * Executa na inicialização do sistema e a cada hora.
 */

import { executarVerificacaoFiscalEmpresas } from "./empresasFiscalCheckJob.service.js";

const INTERVAL_MS = 60 * 60 * 1000; // 1 hora

let intervalId = null;

async function run() {
  try {
    const result = await executarVerificacaoFiscalEmpresas();
    if (result.incompletas?.length > 0) {
      if (result.notificacaoOmitida) {
        console.log(`[empresasFiscalCheck] ${result.incompletas.length} empresa(s) incompleta(s) - notificação omitida (já enviada nas últimas 23h)`);
      } else {
        console.log(`[empresasFiscalCheck] ${result.incompletas.length} empresa(s) com configuração fiscal incompleta - notificação enviada`);
      }
    }
  } catch (err) {
    console.error("[empresasFiscalCheck] Erro:", err?.message || err);
  }
}

export function startEmpresasFiscalCheckScheduler() {
  if (intervalId) return;

  run();
  intervalId = setInterval(run, INTERVAL_MS);
  console.log("[empresasFiscalCheck] Scheduler iniciado (na inicialização + a cada 1h)");
}

export function stopEmpresasFiscalCheckScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
