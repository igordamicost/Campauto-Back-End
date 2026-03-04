import { z } from "zod";
import { getPool } from "../db.js";
import {
  DEFAULT_FIRST_ACCESS,
  DEFAULT_RESET,
  DEFAULT_SUPPLIER_ORDER,
  DEFAULT_CLIENT_QUOTE,
  DEFAULT_NOTA_FISCAL,
} from "../src/constants/defaultEmailTemplates.js";
import { renderTemplate } from "../src/services/templateRenderService.js";
import { sendEmail, sendEmailWithInlineLogo, buildCompanyHeaderHtml } from "../src/services/email.service.js";
import { loadLogo } from "../src/services/logoLoader.js";

const TEMPLATE_KEYS = ["FIRST_ACCESS", "RESET", "SUPPLIER_ORDER", "CLIENT_QUOTE", "NOTA_FISCAL"];
const DEFAULTS = {
  FIRST_ACCESS: DEFAULT_FIRST_ACCESS,
  RESET: DEFAULT_RESET,
  SUPPLIER_ORDER: DEFAULT_SUPPLIER_ORDER,
  CLIENT_QUOTE: DEFAULT_CLIENT_QUOTE,
  NOTA_FISCAL: DEFAULT_NOTA_FISCAL,
};

const putSchema = z.object({
  name: z.string().min(1).max(120),
  subject: z.string().min(1).max(160),
  htmlBody: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});

const previewSchema = z.object({
  subject: z.string(),
  htmlBody: z.string(),
});

function buildMockData() {
  const baseUrl = process.env.FRONT_URL || "http://localhost:3000";

  const tabelaItensMock = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:12px 0">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:8px;border:1px solid #e5e7eb">Código</th>
        <th style="padding:8px;border:1px solid #e5e7eb">Descrição</th>
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">Qtd</th>
        <th style="padding:8px;border:1px solid #e5e7eb">Un</th>
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">Preço unit.</th>
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">Total</th>
      </tr></thead>
      <tbody>
        <tr><td style="padding:8px;border:1px solid #e5e7eb">ABC001</td><td style="padding:8px;border:1px solid #e5e7eb">Produto Exemplo</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right">5</td><td style="padding:8px;border:1px solid #e5e7eb">UN</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right">10,50</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right">52,50</td></tr>
      </tbody>
    </table>`;
  return {
    company_name: "JR Car Peças",
    company_logo: "",
    user_name: "João da Silva",
    user_email: "joao.silva@exemplo.com",
    action_url: `${baseUrl}/acao-de-exemplo?token=abc123`,
    token_expires_in: "24 horas",
    order_number: "PED-12345",
    order_date: "01/03/2026",
    supplier_name: "Fornecedor Exemplo",
    quote_number: "ORC-98765",
    quote_valid_until: "10/03/2026",
    client_name: "Cliente Exemplo",
    quote_total: "R$ 1.234,56",
    tabela_itens: tabelaItensMock,
    observacoes: "Urgente",
    observacoes_html: "<p style=\"margin:12px 0 0;color:#555;line-height:1.6\"><strong>Observações:</strong> Urgente</p>",
    nota_numero: "12345",
    empresa_emitente_nome: "JR Car Peças",
    empresa_emitente_cnpj: "12.345.678/0001-90",
    cliente_nome: "Cliente Exemplo",
    valor_total: "R$ 1.234,56",
    nota_chave: "35240312345678000190550010000123451234567890",
    empresa_por_qual: "JR Car Peças",
  };
}

function stripScript(html) {
  if (typeof html !== "string") return "";
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

async function list(req, res) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT template_key, name, subject, html_body, is_active FROM email_templates"
  );

  const byKey = Object.fromEntries(rows.map((r) => [r.template_key, r]));

  const result = TEMPLATE_KEYS.map((key) => {
    const row = byKey[key];
    if (row) {
      return {
        templateKey: key,
        name: row.name,
        subject: row.subject,
        htmlBody: row.html_body,
        isActive: Boolean(row.is_active),
      };
    }
    const def = DEFAULTS[key] || {};
    return {
      templateKey: key,
      name: def.name || key,
      subject: def.subject || "",
      htmlBody: def.html_body || "",
      isActive: true,
    };
  });

  res.json(result);
}

async function update(req, res) {
  const { templateKey } = req.params;

  if (!TEMPLATE_KEYS.includes(templateKey)) {
    return res.status(400).json({
      message: "templateKey inválido. Use FIRST_ACCESS, RESET, SUPPLIER_ORDER, CLIENT_QUOTE ou NOTA_FISCAL",
    });
  }

  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Dados inválidos",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { name, subject, htmlBody, isActive } = parsed.data;
  const safeHtml = stripScript(htmlBody);

  const pool = getPool();
  await pool.query(
    `
    INSERT INTO email_templates (template_key, name, subject, html_body, is_active)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      subject = VALUES(subject),
      html_body = VALUES(html_body),
      is_active = VALUES(is_active),
      updated_at = NOW()
  `,
    [templateKey, name, subject, safeHtml, isActive ? 1 : 0]
  );

  const [rows] = await pool.query(
    "SELECT template_key, name, subject, html_body, is_active FROM email_templates WHERE template_key = ?",
    [templateKey]
  );

  const r = rows[0];
  res.json({
    templateKey: r.template_key,
    name: r.name,
    subject: r.subject,
    htmlBody: r.html_body,
    isActive: Boolean(r.is_active),
  });
}

async function preview(req, res) {
  const { templateKey } = req.params;

  if (!TEMPLATE_KEYS.includes(templateKey)) {
    return res.status(400).json({
      message: "templateKey inválido. Use FIRST_ACCESS, RESET, SUPPLIER_ORDER, CLIENT_QUOTE ou NOTA_FISCAL",
    });
  }

  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "subject e htmlBody são obrigatórios",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { subject, htmlBody } = parsed.data;
  const safeHtml = stripScript(htmlBody);

  const baseUrl = process.env.FRONT_URL || "http://localhost:3000";
  const mock = buildMockData();

  const pool = getPool();
  const [empresaRows] = await pool.query(
    "SELECT nome_fantasia, razao_social, logo_url FROM empresas LIMIT 1"
  );
  if (empresaRows[0]) {
    mock.company_name = empresaRows[0].nome_fantasia || empresaRows[0].razao_social || mock.company_name;
    mock.company_logo = empresaRows[0].logo_url && typeof empresaRows[0].logo_url === "string"
      ? empresaRows[0].logo_url.trim()
      : "";
  }
  if (templateKey === "RESET") {
    mock.action_url = `${baseUrl}/recuperar-senha?token=TESTE`;
  } else if (templateKey === "FIRST_ACCESS") {
    mock.action_url = `${baseUrl}/definir-senha?token=TESTE`;
  } else if (templateKey === "NOTA_FISCAL") {
    mock.nota_numero = "12345";
    mock.empresa_emitente_nome = mock.company_name;
    mock.empresa_emitente_cnpj = "12.345.678/0001-90";
    mock.cliente_nome = "Cliente Exemplo";
    mock.valor_total = "R$ 1.234,56";
    mock.nota_chave = "35240312345678000190550010000123451234567890";
    mock.empresa_por_qual = mock.company_name;
  }

  const renderedSubject = renderTemplate(subject, mock);
  const renderedHtml = renderTemplate(safeHtml, mock);

  res.json({
    subject: renderedSubject,
    htmlBody: renderedHtml,
    actionUrl: mock.action_url,
  });
}

async function testTemplate(req, res) {
  const { templateKey } = req.params;

  if (!TEMPLATE_KEYS.includes(templateKey)) {
    return res.status(400).json({
      message:
        "templateKey inválido. Use FIRST_ACCESS, RESET, SUPPLIER_ORDER, CLIENT_QUOTE ou NOTA_FISCAL",
    });
  }

  const pool = getPool();

  // Buscar dados reais do usuário autenticado
  const [userRows] = await pool.query(
    "SELECT name, email FROM users WHERE id = ?",
    [req.user.userId]
  );
  const user = userRows[0];
  if (!user || !user.email) {
    return res
      .status(400)
      .json({ message: "Não foi possível obter e-mail do usuário autenticado" });
  }

  // Buscar template do banco
  const [tplRows] = await pool.query(
    "SELECT subject, html_body, is_active FROM email_templates WHERE template_key = ?",
    [templateKey]
  );
  const tpl = tplRows[0];

  if (!tpl) {
    return res
      .status(404)
      .json({ message: "Template não encontrado para o usuário autenticado" });
  }

  if (!tpl.is_active) {
    return res
      .status(400)
      .json({ message: "Template inativo. Ative o template antes de testar." });
  }

  const baseUrl = process.env.FRONT_URL || "http://localhost:3000";

  let companyName = "JR Car Peças";
  let logoUrl = null;
  const [empresaRows] = await pool.query(
    "SELECT nome_fantasia, razao_social, logo_url FROM empresas LIMIT 1"
  );
  if (empresaRows[0]) {
    companyName = empresaRows[0].nome_fantasia || empresaRows[0].razao_social || companyName;
    if (empresaRows[0].logo_url && typeof empresaRows[0].logo_url === "string") {
      logoUrl = empresaRows[0].logo_url.trim();
    }
  }

  const logoAttachment = await loadLogo({ logoUrl });

  const actionUrl =
    templateKey === "RESET"
      ? `${baseUrl}/recuperar-senha?token=TESTE-NAO-CLIQUE`
      : templateKey === "FIRST_ACCESS"
        ? `${baseUrl}/definir-senha?token=TESTE-NAO-CLIQUE`
        : `${baseUrl}/acao-de-exemplo?token=teste`;

  const context = {
    company_name: companyName,
    company_logo: logoAttachment ? "cid:company-logo" : "",
    company_header_html: buildCompanyHeaderHtml(companyName, !!logoAttachment),
    user_name: user.name || "Usuário",
    user_email: user.email,
    action_url: actionUrl,
    token_expires_in: "1 hora",
    order_number: "PED-TESTE-123",
    order_date: "01/03/2026",
    supplier_name: "Fornecedor Teste",
    quote_number: "ORC-TESTE-456",
    quote_valid_until: "10/03/2026",
    client_name: "Cliente Teste",
    quote_total: "R$ 999,99",
    nota_numero: "12345",
    empresa_emitente_nome: companyName,
    empresa_emitente_cnpj: "12.345.678/0001-90",
    cliente_nome: "Cliente Teste",
    valor_total: "R$ 999,99",
    nota_chave: "35240312345678000190550010000123451234567890",
    empresa_por_qual: companyName,
  };

  const safeHtml = stripScript(tpl.html_body);
  const renderedSubject = renderTemplate(tpl.subject, context);
  const renderedHtml = renderTemplate(safeHtml, context);

  try {
    await sendEmailWithInlineLogo(user.email, renderedSubject, renderedHtml, { logoAttachment });
    console.log(
      `[EmailTemplates] E-mail de teste (${templateKey}) enviado para ${user.email}`
    );
    return res.json({
      message: `E-mail de teste enviado para ${user.email}`,
    });
  } catch (error) {
    console.error(
      `[EmailTemplates] Falha ao enviar e-mail de teste (${templateKey}) para ${user.email}:`,
      error?.message || String(error)
    );
    return res.status(500).json({
      message: "Erro ao enviar e-mail de teste",
      error: process.env.NODE_ENV === "development" ? error?.message : undefined,
    });
  }
}

export { list, update, preview, testTemplate };
