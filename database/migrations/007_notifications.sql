-- Migração: Sistema de Notificações
-- Executa com: mysql -u user -p database < 007_notifications.sql

USE campauto;

-- Tabela de Notificações
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT 'Usuário destinatário',
  type VARCHAR(50) NOT NULL COMMENT 'Ex: RESERVATION_DUE_SOON, RESERVATION_OVERDUE, etc',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME NULL,
  metadata JSON NULL COMMENT 'Dados adicionais (ex: reservation_id, sale_id)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela para controle de notificações enviadas (evitar duplicatas)
CREATE TABLE IF NOT EXISTS notification_sent_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT NULL,
  user_id INT NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  sent_date DATE NOT NULL COMMENT 'Data do envio (para controle diário)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_reservation_user_type_date (reservation_id, user_id, notification_type, sent_date),
  CONSTRAINT fk_nsl_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  CONSTRAINT fk_nsl_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reservation (reservation_id),
  INDEX idx_user (user_id),
  INDEX idx_sent_date (sent_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
