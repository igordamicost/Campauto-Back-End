import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getPool } from "../db.js";
import { RBACRepository } from "../src/repositories/rbac.repository.js";

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT id, name, email, role_id, password, blocked
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email]
  );

  const user = rows[0];
  const invalidCreds = { message: 'E-mail ou senha incorretos' };
  if (!user) return res.status(401).json(invalidCreds);
  if (user.blocked) return res.status(403).json({ message: 'Conta bloqueada' });
  if (!user.password) return res.status(403).json({ message: 'Defina sua senha primeiro (verifique o e-mail)' });

  let ok = false;
  if (user.password && user.password.startsWith('$2')) {
    ok = await bcrypt.compare(password, user.password);
  } else {
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    ok = hash === user.password;
  }

  if (!ok) return res.status(401).json(invalidCreds);

  const token = jwt.sign(
    { userId: user.id, roleId: user.role_id },
    process.env.JWT_SECRET
  );
  return res.json({ token });
}

async function getMe(req, res) {
  try {
    const userId = req.user.userId;
    const userWithPermissions = await RBACRepository.getUserWithPermissions(userId);

    if (!userWithPermissions) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Formatar resposta
    const response = {
      id: userWithPermissions.id,
      name: userWithPermissions.name,
      email: userWithPermissions.email,
      role: {
        id: userWithPermissions.role_id,
        name: userWithPermissions.role_name,
        description: userWithPermissions.role_description,
      },
      permissions: userWithPermissions.permissions,
      permissionsDetail: userWithPermissions.permissionsDetail,
    };

    return res.json(response);
  } catch (error) {
    console.error('Error in getMe:', error);
    return res.status(500).json({ message: 'Erro ao buscar dados do usuário' });
  }
}

export { login, getMe };
