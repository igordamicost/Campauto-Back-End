/**
 * Job de limpeza de sessões expiradas/revogadas.
 * Executa periodicamente (ex: a cada hora).
 */

import { cleanupExpiredSessions } from "./sessionStore.service.js";

const INTERVAL_MS = 60 * 60 * 1000; // 1 hora

let intervalId = null;

export function startSessionCleanupJob() {
  if (intervalId) return;

  const run = async () => {
    try {
      const deleted = await cleanupExpiredSessions();
      if (deleted > 0) {
        console.log(`[sessionCleanup] ${deleted} sessão(ões) removida(s)`);
      }
    } catch (err) {
      console.error("[sessionCleanup] Erro:", err?.message || err);
    }
  };

  run();
  intervalId = setInterval(run, INTERVAL_MS);
  console.log("[sessionCleanup] Job iniciado (intervalo: 1h)");
}

export function stopSessionCleanupJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
