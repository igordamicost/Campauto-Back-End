import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getPool } from "../db.js";

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT id, name, email, role, password, blocked
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email]
  );

  const user = rows[0];
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  if (user.blocked) return res.status(403).json({ message: 'Account is blocked' });

  let ok = false;
  if (user.password && user.password.startsWith('$2')) {
    ok = await bcrypt.compare(password, user.password);
  } else {
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    ok = hash === user.password;
  }

  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET
  );
  return res.json({ token });
}

export { login };
