import { getPool } from "../db.js";

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

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT u.id, u.name, u.email, u.role, u.created_at,
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
      userUpdates.push('email = ?');
      userParams.push(email);
    }
    if (password !== undefined && password !== '') {
      userUpdates.push('password = SHA2(?, 256)');
      userParams.push(password);
    }
    if (role !== undefined) {
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
    return res.json({ message: 'Updated' });
  } catch (err) {
    await connection.rollback();
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email already exists' });
    }
    throw err;
  } finally {
    connection.release();
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
  res.json({ message: 'Deleted' });
}

export { list, createUser, updateUser, removeUser };
