import { getPool } from "../../db.js";

/**
 * Registra envio (ou tentativa de envio) de orçamento para cliente.
 */
export async function logClientQuoteEmail({
  orcamentoId,
  clienteId,
  to,
  subject,
  html,
  sentByUserId,
  status = "SUCCESS",
  errorMessage = null,
}) {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO email_client_quote_logs
        (orcamento_id, cliente_id, to_email, subject, html_body,
         template_key, sent_by_user_id, status, error_message)
      VALUES (?, ?, ?, ?, ?, 'CLIENT_QUOTE', ?, ?, ?)
    `,
    [
      orcamentoId ?? null,
      clienteId ?? null,
      to,
      subject,
      html,
      sentByUserId ?? null,
      status,
      errorMessage,
    ]
  );
}

/**
 * Registra envio (ou tentativa de envio) de pedido para fornecedor.
 * @param {Object} opts
 * @param {number|null} opts.pedidoId - ID da compra (legado)
 * @param {number|null} opts.pedidoCompraId - ID do pedido_compra (novo fluxo)
 */
export async function logSupplierOrderEmail({
  pedidoId,
  pedidoCompraId,
  fornecedorId,
  to,
  subject,
  html,
  sentByUserId,
  status = "SUCCESS",
  errorMessage = null,
}) {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO email_supplier_order_logs
        (pedido_id, pedido_compra_id, fornecedor_id, to_email, subject, html_body,
         template_key, sent_by_user_id, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, 'SUPPLIER_ORDER', ?, ?, ?)
    `,
    [
      pedidoId ?? null,
      pedidoCompraId ?? null,
      fornecedorId ?? null,
      to,
      subject,
      html,
      sentByUserId ?? null,
      status,
      errorMessage,
    ]
  );
}

