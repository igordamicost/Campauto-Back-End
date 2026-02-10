import { getPool } from "../db.js";
import { transporter } from "../src/config/email.js";

async function createUser(req, res) {
  const { name, email, password, role = 'USER', employee = {} } = req.body || {};
  const { full_name, phone } = employee;

  if (!name || !email || !password || !full_name) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [userResult] = await connection.query(
      `
        INSERT INTO users (name, email, password, role)
        VALUES (?, ?, SHA2(?, 256), ?)
      `,
      [name, email, password, role]
    );

    const userId = userResult.insertId;

    await connection.query(
      `
        INSERT INTO employees (user_id, full_name, phone)
        VALUES (?, ?, ?)
      `,
      [userId, full_name, phone || null]
    );

    await connection.commit();

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Seu acesso foi criado',
      text: `Olá ${name}, seu usuário foi criado.\nEmail: ${email}\nSenha: ${password}`,
    });

    return res.status(201).json({ id: userId });
  } catch (err) {
    await connection.rollback();
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email already exists' });
    }
    throw err;
  } finally {
    connection.release();
  }
}

export { createUser };
