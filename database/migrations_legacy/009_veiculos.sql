-- Veículos vinculados a clientes (para orçamentos e oficina)
CREATE TABLE IF NOT EXISTS veiculos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  marca VARCHAR(120) NULL,
  modelo VARCHAR(120) NULL,
  placa VARCHAR(20) NULL,
  ano VARCHAR(10) NULL,
  renavan VARCHAR(30) NULL,
  chassi VARCHAR(50) NULL,
  cor VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_veiculos_cliente (cliente_id),
  CONSTRAINT fk_veiculos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
