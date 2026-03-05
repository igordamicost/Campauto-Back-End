-- Migration 055: Campos de observações no orçamento
-- observacoes_externas: corpo do e-mail enviado ao cliente
-- observacoes_nf: informações complementares da Nota Fiscal

ALTER TABLE orcamentos
  ADD COLUMN observacoes_externas TEXT NULL,
  ADD COLUMN observacoes_nf TEXT NULL;

-- Atualiza template CLIENT_QUOTE para incluir {{observacoes_externas_html}}
-- (insere antes do parágrafo "Este é um e-mail automático")
UPDATE email_templates
SET html_body = REPLACE(
  html_body,
  '</p>\n    <p style="margin:16px 0 0;color:#888;font-size:12px">',
  '</p>\n    {{observacoes_externas_html}}\n    <p style="margin:16px 0 0;color:#888;font-size:12px">'
)
WHERE template_key = 'CLIENT_QUOTE'
  AND html_body NOT LIKE '%{{observacoes_externas_html}}%'
  AND html_body LIKE '%Este é um e-mail automático%';
