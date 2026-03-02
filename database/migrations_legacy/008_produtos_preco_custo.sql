-- Migração: Coluna preco_custo na tabela produtos
-- Uso: custo do produto para exibição no orçamento (não imprime); atualizado pelo front ao editar no orçamento.
-- Executa com: mysql -u user -p database < 008_produtos_preco_custo.sql
-- Após rodar: GET/PUT /produtos passam a incluir preco_custo (a API não precisa ser reiniciada).

USE campauto;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'produtos' AND column_name = 'preco_custo'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE produtos ADD COLUMN preco_custo DECIMAL(10,2) NULL COMMENT ''Custo do produto (uso interno no orçamento)'' AFTER observacao',
  'SELECT ''Column preco_custo already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
