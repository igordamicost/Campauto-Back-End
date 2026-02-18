import bcrypt from "bcryptjs";
import { getPool } from "../db.js";
import { createPasswordToken } from "../src/services/passwordTokenService.js";
import { sendEmail } from "../src/services/gmailService.js";
import { getTemplate, renderWithData } from "../src/services/templateService.js";

async function list(req, res) {
  const pool = getPool();
  const limit = Number(req.query.limit || req.query.perPage || 10);
  const page = Math.max(1, Number(req.query.page || 1));
  const offset = (page - 1) * limit;
  const q = (req.query.q || "").trim();

  const params = [];
  const whereParts = [];

  if (q) {
    whereParts.push("(u.name LIKE ? OR u.email LIKE ? OR e.full_name LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (req.query.role) {
    whereParts.push("u.role = ?");
    params.push(req.query.role);
  }
  if (req.query.blocked !== undefined && req.query.blocked !== "") {
    const blocked = String(req.query.blocked).toLowerCase();
    if (blocked === "1" || blocked === "true") {
      whereParts.push("u.blocked = 1");
    } else if (blocked === "0" || blocked === "false") {
      whereParts.push("u.blocked = 0");
    }
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT u.id, u.name, u.email, u.role, u.blocked, u.created_at,
             e.full_name AS employee_name, e.phone AS employee_phone
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      ${whereSql}
      ORDER BY u.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const [[{ total }]] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      ${whereSql}
    `,
    params
  );

  const totalPages = Math.ceil(total / limit) || 1;
  res.json({ data: rows, page, perPage: limit, total, totalPages });
}

async function getById(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT u.id, u.name, u.email, u.role, u.blocked, u.created_at,
             e.full_name AS employee_name, e.phone AS employee_phone
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE u.id = ?
    `,
    [id]
  );
  const user = rows[0];
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
}

async function createUser(req, res) {
  const { name, email, password, role = "USER", employee = {} } = req.body || {};
  const { full_name, phone } = employee;

  // Validações obrigatórias
  if (!name || !email) {
    return res.status(400).json({ message: "Missing required fields: name, email" });
  }

  // Se password foi fornecido, validar e usar. Caso contrário, usuário definirá depois (must_set_password = 1)
  let hashedPassword = null;
  let mustSetPassword = 1;

  if (password && password.trim() !== "") {
    // Validar senha (mínimo 6 caracteres)
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must have at least 6 characters" });
    }
    // Fazer hash da senha
    hashedPassword = await bcrypt.hash(password, 12);
    mustSetPassword = 0; // Senha já definida
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  let userId;

  try {
    await connection.beginTransaction();

    // Verificar se email já existe
    const [existing] = await connection.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({ message: "Email already exists" });
    }

    // Mapear role string para role_id (se usando sistema RBAC)
    let roleId = null;
    let roleString = role;

    if (role) {
      const [roleRows] = await connection.query(
        "SELECT id FROM roles WHERE name = ?",
        [role.toUpperCase()]
      );
      if (roleRows.length > 0) {
        roleId = roleRows[0].id;
      }
    }

    // Inserir usuário
    if (roleId !== null) {
      // Sistema RBAC: usar role_id
      const [userResult] = await connection.query(
        `
          INSERT INTO users (name, email, password, role, role_id, must_set_password)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [name, email, hashedPassword, roleString, roleId, mustSetPassword]
      );
      userId = userResult.insertId;
    } else {
      // Sistema antigo: usar role string
      const [userResult] = await connection.query(
        `
          INSERT INTO users (name, email, password, role, must_set_password)
          VALUES (?, ?, ?, ?, ?)
        `,
        [name, email, hashedPassword, roleString, mustSetPassword]
      );
      userId = userResult.insertId;
    }

    // Criar employee se full_name foi fornecido
    if (full_name) {
      await connection.query(
        `
          INSERT INTO employees (user_id, full_name, phone)
          VALUES (?, ?, ?)
        `,
        [userId, full_name, phone || null]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    connection.release();
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email already exists" });
    }
    console.error("Erro ao criar usuário:", err);
    return res.status(500).json({
      message: "Erro interno do servidor ao criar usuário",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  } finally {
    connection.release();
  }

  // Se senha não foi fornecida, enviar email para definir senha
  if (mustSetPassword === 1) {
    try {
      const token = await createPasswordToken(userId, "FIRST_ACCESS");
      const link = `${process.env.FRONT_URL}/definir-senha?token=${token}`;
      const companyName = process.env.COMPANY_NAME || "Campauto";

      const template = await getTemplate(req.user?.userId, "FIRST_ACCESS");
      const { subject, html } = renderWithData(template, {
        user_name: name,
        user_email: email,
        action_url: link,
        token_expires_in: "1 hora",
        company_name: companyName,
      });

      const masterUserId = req.user?.userId;
      const result = await sendEmail(masterUserId, email, subject, html);

      if (!result.success) {
        return res.status(201).json({
          id: userId,
          message: "Usuário criado, mas não foi possível enviar o e-mail. " + (result.error || "Verifique a integração Gmail."),
        });
      }
    } catch (err) {
      return res.status(201).json({
        id: userId,
        message: "Usuário criado, mas falha ao enviar e-mail de boas-vindas. Verifique a integração Gmail.",
      });
    }
  }

  return res.status(201).json({
    id: userId,
    name,
    email,
    role: roleString,
    message: "Usuário criado com sucesso",
  });
}

async function updateUser(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid id' });

  const { name, email, password, role, employee = {} } = req.body || {};
  const { full_name, phone } = employee;

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    const [rows] = await connection.query(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      connection.release();
      return res.status(404).json({ message: 'User not found' });
    }

    await connection.beginTransaction();

    const userUpdates = [];
    const userParams = [];

    if (name !== undefined) {
      userUpdates.push('name = ?');
      userParams.push(name);
    }
    if (email !== undefined) {
      // Verificar se email já existe em outro usuário
      const [existing] = await connection.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, id]
      );
      if (existing.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({ message: 'Email already exists' });
      }
      userUpdates.push('email = ?');
      userParams.push(email);
    }
    if (password !== undefined && password !== '') {
      // Validar senha
      if (password.length < 6) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: 'Password must have at least 6 characters' });
      }
      // Usar bcrypt ao invés de SHA2 para consistência
      const hashedPassword = await bcrypt.hash(password, 12);
      userUpdates.push('password = ?');
      userParams.push(hashedPassword);
      userUpdates.push('must_set_password = ?');
      userParams.push(0); // Senha definida
    }
    if (role !== undefined) {
      // Mapear role string para role_id (se usando sistema RBAC)
      const [roleRows] = await connection.query(
        'SELECT id FROM roles WHERE name = ?',
        [role.toUpperCase()]
      );
      if (roleRows.length > 0) {
        userUpdates.push('role_id = ?');
        userParams.push(roleRows[0].id);
      }
      userUpdates.push('role = ?');
      userParams.push(role);
    }

    if (userUpdates.length) {
      await connection.query(
        `UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`,
        [...userParams, id]
      );
    }

    if (full_name !== undefined || phone !== undefined) {
      const empUpdates = [];
      const empParams = [];
      if (full_name !== undefined) {
        empUpdates.push('full_name = ?');
        empParams.push(full_name);
      }
      if (phone !== undefined) {
        empUpdates.push('phone = ?');
        empParams.push(phone);
      }
      if (empUpdates.length) {
        await connection.query(
          `UPDATE employees SET ${empUpdates.join(', ')} WHERE user_id = ?`,
          [...empParams, id]
        );
      }
    }

    await connection.commit();
    connection.release();
    return res.json({ message: 'Updated' });
  } catch (err) {
    await connection.rollback();
    connection.release();
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email already exists' });
    }
    console.error('Erro ao atualizar usuário:', err);
    return res.status(500).json({
      message: 'Erro interno do servidor ao atualizar usuário',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}

async function removeUser(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid id' });

  const pool = getPool();
  const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);

  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({ message: "Deleted" });
}

async function blockUser(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const pool = getPool();
  const [rows] = await pool.query("SELECT id, blocked FROM users WHERE id = ?", [
    id,
  ]);
  const user = rows[0];
  if (!user) return res.status(404).json({ message: "User not found" });

  const newBlocked = user.blocked ? 0 : 1;
  await pool.query("UPDATE users SET blocked = ? WHERE id = ?", [newBlocked, id]);

  res.json({
    message: newBlocked ? "User blocked" : "User unblocked",
    blocked: Boolean(newBlocked),
  });
}

async function resetPasswordUser(req, res) {
  const id = Number(req.params.id);
  const { password } = req.body || {};

  if (!id) return res.status(400).json({ message: "Invalid id" });
  if (!password || String(password).length < 6) {
    return res.status(400).json({ message: "Password must have at least 6 characters" });
  }

  const pool = getPool();
  const [rows] = await pool.query("SELECT id FROM users WHERE id = ?", [id]);
  if (!rows.length) return res.status(404).json({ message: "User not found" });

  const hash = await bcrypt.hash(password, 10);
  await pool.query("UPDATE users SET password = ? WHERE id = ?", [hash, id]);

  res.json({ message: "Password reset successfully" });
}

export { list, getById, createUser, updateUser, removeUser, blockUser, resetPasswordUser };
