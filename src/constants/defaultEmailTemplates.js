/**
 * Templates padrão quando não existir no banco.
 * Placeholders suportados (podem ser usados em subject e HTML):
 * {{company_name}}, {{company_logo}}, {{company_header_html}},
 * {{user_name}}, {{user_email}}, {{action_url}}, {{token_expires_in}},
 * {{order_number}}, {{order_date}}, {{supplier_name}},
 * {{quote_number}}, {{quote_valid_until}}, {{client_name}}, {{quote_total}}
 */

export const DEFAULT_FIRST_ACCESS = {
  name: "Primeiro acesso - Padrão",
  subject: "Defina sua senha",
  html_body: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;font-family:Arial,sans-serif;background:#f5f5f5;padding:20px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="text-align:center;margin-bottom:16px">{{company_header_html}}</div>
    <h2 style="margin:0 0 16px;color:#333;font-size:20px">Olá, {{user_name}}!</h2>
    <p style="margin:0 0 24px;color:#555;line-height:1.6">
      Você foi cadastrado em {{company_name}}. Para acessar o sistema, defina sua senha clicando no botão abaixo.
    </p>
    <a href="{{action_url}}" style="display:inline-block;background:#0d6efd;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
      Definir senha
    </a>
    <p style="margin:24px 0 0;color:#888;font-size:12px">Este link expira em {{token_expires_in}}.</p>
    <p style="margin:8px 0 0;color:#888;font-size:12px;word-break:break-all">Ou acesse: {{action_url}}</p>
  </div>
</body>
</html>
`.trim(),
};

export const DEFAULT_RESET = {
  name: "Recuperar senha - Padrão",
  subject: "Recupere sua senha",
  html_body: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;font-family:Arial,sans-serif;background:#f5f5f5;padding:20px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="text-align:center;margin-bottom:16px">{{company_header_html}}</div>
    <h2 style="margin:0 0 16px;color:#333;font-size:20px">Olá, {{user_name}}!</h2>
    <p style="margin:0 0 24px;color:#555;line-height:1.6">
      Foi solicitada a recuperação de senha para {{user_email}} em {{company_name}}. Clique no botão abaixo para definir uma nova senha.
    </p>
    <a href="{{action_url}}" style="display:inline-block;background:#0d6efd;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
      Recuperar senha
    </a>
    <p style="margin:24px 0 0;color:#888;font-size:12px">Este link expira em {{token_expires_in}}.</p>
    <p style="margin:8px 0 0;color:#888;font-size:12px;word-break:break-all">Ou acesse: {{action_url}}</p>
  </div>
</body>
</html>
`.trim(),
};

export const DEFAULT_SUPPLIER_ORDER = {
  name: "Pedido para fornecedor - Padrão",
  subject: "Pedido #{{order_number}} - {{company_name}}",
  html_body: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;font-family:Arial,sans-serif;background:#f5f5f5;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="text-align:center;margin-bottom:16px">{{company_header_html}}</div>
    <h2 style="margin:0 0 8px;color:#333;font-size:20px">Pedido {{order_number}}</h2>
    <p style="margin:0 0 8px;color:#555;line-height:1.6">
      Olá, {{supplier_name}}.
    </p>
    <p style="margin:0 0 8px;color:#555;line-height:1.6">
      Encaminhamos o pedido {{order_number}}, emitido em {{order_date}} por {{company_name}}.
    </p>
    <p style="margin:16px 0 0;color:#888;font-size:12px">
      Este é um e-mail automático, por favor não responda diretamente.
    </p>
  </div>
</body>
</html>
`.trim(),
};

export const DEFAULT_CLIENT_QUOTE = {
  name: "Orçamento para cliente - Padrão",
  subject: "Orçamento #{{quote_number}} - {{company_name}}",
  html_body: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;font-family:Arial,sans-serif;background:#f5f5f5;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="text-align:center;margin-bottom:16px">{{company_header_html}}</div>
    <h2 style="margin:0 0 8px;color:#333;font-size:20px">Orçamento {{quote_number}}</h2>
    <p style="margin:0 0 8px;color:#555;line-height:1.6">
      Olá, {{client_name}}.
    </p>
    <p style="margin:0 0 8px;color:#555;line-height:1.6">
      Seu orçamento é válido até {{quote_valid_until}}. Valor total: {{quote_total}}.
    </p>
    <p style="margin:16px 0 0;color:#888;font-size:12px">
      Este é um e-mail automático, por favor não responda diretamente.
    </p>
  </div>
</body>
</html>
`.trim(),
};
