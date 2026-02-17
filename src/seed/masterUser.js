import bcrypt from "bcryptjs";
import { getPool } from "../../db.js";

const MASTER_EMAIL = "contatodmsotolani@gmail.com";

async function ensureColumns() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      cpf VARCHAR(20) NULL,
      telefone VARCHAR(30) NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('MASTER','USER') NOT NULL DEFAULT 'USER',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const ensureColumn = async (column, definition) => {
    const [rows] = await pool.query(
      `
        SELECT COUNT(*) AS cnt
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'users'
          AND column_name = ?
      `,
      [column]
    );
    if (rows[0].cnt === 0) {
      await pool.query(`ALTER TABLE users ADD COLUMN ${definition}`);
    }
  };

  await ensureColumn("cpf", "cpf VARCHAR(20) NULL");
  await ensureColumn("telefone", "telefone VARCHAR(30) NULL");
  await ensureColumn("blocked", "blocked TINYINT(1) DEFAULT 0");
}

async function seedMasterUser() {
  const pool = getPool();

  await ensureColumns();

  const [rows] = await pool.query(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [MASTER_EMAIL]
  );
  if (rows.length > 0) return;

  const hash = await bcrypt.hash("123456", 10);

  await pool.query(
    `
      INSERT INTO users (name, cpf, telefone, email, role, password)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      "igor sotolani",
      "70781915104",
      "67991303311",
      MASTER_EMAIL,
      "MASTER",
      hash
    ]
  );
}

export { seedMasterUser };
