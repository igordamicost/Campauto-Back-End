-- Migration 057: Modelo de grupos para vínculos de produtos
-- Substitui produto_vinculos (pares) por produto_vinculo_grupos + produto_vinculo_grupo_itens
-- Permite criar grupo com vários produtos de uma vez: { produto_ids: [1,2,3,4,5] }

-- ========== 1. Novas tabelas ==========
CREATE TABLE IF NOT EXISTS produto_vinculo_grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS produto_vinculo_grupo_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_id INT NOT NULL,
  produto_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_produto_grupo (produto_id),
  CONSTRAINT fk_pvgi_grupo FOREIGN KEY (grupo_id) REFERENCES produto_vinculo_grupos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pvgi_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
  INDEX idx_pvgi_grupo (grupo_id),
  INDEX idx_pvgi_produto (produto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 2. Remover tabela antiga (produto_vinculos) ==========
-- Dados existentes serão perdidos; recrie vínculos no novo modelo (grupos)
DROP TABLE IF EXISTS produto_vinculos;
