-- Adiciona template NOTA_FISCAL para envio de notas fiscais por e-mail
SET @tbl = (SELECT COUNT(*) FROM information_schema.TABLES WHERE table_schema = DATABASE() AND table_name = 'email_templates');
SET @sql = IF(@tbl > 0,
  'ALTER TABLE email_templates MODIFY COLUMN template_key ENUM(''FIRST_ACCESS'',''RESET'',''SUPPLIER_ORDER'',''CLIENT_QUOTE'',''NOTA_FISCAL'') NOT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT INTO email_templates (template_key, name, subject, html_body, is_active)
SELECT 'NOTA_FISCAL', 'Nota Fiscal - Padrão',
  'Nota Fiscal {{nota_numero}} - {{empresa_emitente_nome}}',
  '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;font-family:Arial,sans-serif;padding:20px">
  <div style="max-width:600px;margin:0 auto">
    <h2>Nota Fiscal {{nota_numero}}</h2>
    <p>Prezado(a) {{cliente_nome}},</p>
    <p>Segue em anexo a Nota Fiscal emitida por <strong>{{empresa_emitente_nome}}</strong> (CNPJ {{empresa_emitente_cnpj}}).</p>
    <p><strong>Valor total:</strong> {{valor_total}}</p>
    <p><strong>Chave de acesso:</strong> {{nota_chave}}</p>
    <p>Atenciosamente,<br>{{empresa_por_qual}}</p>
  </div></body></html>',
  1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE template_key = 'NOTA_FISCAL');
