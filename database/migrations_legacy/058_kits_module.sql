-- Migration 058: Módulo Kits (Vínculos)
-- Kits agrupam produtos (ex: Kit troca de óleo = Óleo + Filtro)
-- Ao adicionar kit no orçamento, todos os produtos são incluídos

-- ========== 1. Tabela kits ==========
CREATE TABLE IF NOT EXISTS kits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_kit_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 2. Tabela kit_itens ==========
CREATE TABLE IF NOT EXISTS kit_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kit_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  ordem INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ki_kit FOREIGN KEY (kit_id) REFERENCES kits(id) ON DELETE CASCADE,
  CONSTRAINT fk_ki_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
  INDEX idx_ki_kit (kit_id),
  INDEX idx_ki_produto (produto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
