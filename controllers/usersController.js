import bcrypt from "bcryptjs";
import { getPool } from "../db.js";
import { createPasswordToken } from "../src/services/passwordTokenService.js";
import { sendEmailWithInlineLogo, buildCompanyHeaderHtml } from "../src/services/email.service.js";
import { loadLogo } from "../src/services/logoLoader.js";
import { getTemplate, renderWithData } from "../src/services/templateService.js";

function isMasterRole(roleString, roleId) {
  const role = String(roleString || "").toUpperCase();
  return role === "MASTER" || roleId === 1;
}

async function ensureEmpresaExists(connectionOrPool, empresaId) {
  if (empresaId == null) return false;
  const [rows] = await connectionOrPool.query(
    "SELECT id FROM empresas WHERE id = ? LIMIT 1",
    [Number(empresaId)]
  );
  return rows.length > 0;
}

function buildEmpresaContextFromRow(row) {
  if (!row) return { companyName: null, companyLogo: null, empresa: null };
  const empresaNome =
    row.nome_fantasia || row.razao_social || process.env.COMPANY_NAME || "Campauto";
  const companyLogo = row.logo_url && typeof row.logo_url === "string" ? row.logo_url.trim() : null;

  return {
    companyName: empresaNome,
    companyLogo,
    empresa: {
      id: row.id,
      nome_fantasia: row.nome_fantasia,
      razao_social: row.razao_social,
      cnpj: row.cnpj,
      endereco: row.endereco,
      cidade: row.cidade,
      estado: row.estado,
      telefone: row.telefone,
    },
  };
}

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
  const { name, email, password, role, employee = {}, empresa_id } = req.body || {};
  const { full_name, phone } = employee;

  // Validações obrigatórias
  if (!name || !email) {
    return res.status(400).json({ message: "Missing required fields: name, email" });
  }

    // Definir role padrão se não fornecido
    const roleString = (role || "USER").toUpperCase();

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

    // Mapear role string para role_id (sistema RBAC)
    let roleId = null;

    try {
      // Sempre tentar buscar role_id da tabela roles
      const [roleRows] = await connection.query(
        "SELECT id FROM roles WHERE name = ?",
        [roleString]
      );
      
      if (roleRows.length > 0) {
        roleId = roleRows[0].id;
      } else {
        // Se role não encontrada, usar valores padrão baseados no nome
        // MASTER -> role_id = 1, USER -> role_id = 3
        if (roleString === "MASTER") {
          roleId = 1;
        } else {
          roleId = 3; // USER é o padrão
        }
        console.warn(`Role '${roleString}' não encontrada na tabela roles, usando role_id padrão: ${roleId}`);
      }
    } catch (err) {
      // Se tabela roles não existe, usar valores padrão
      console.warn("Tabela roles não encontrada, usando valores padrão:", err.message);
      if (roleString === "MASTER") {
        roleId = 1;
      } else {
        roleId = 3; // USER é o padrão
      }
    }

    // Validar empresa_id de acordo com a role
    const isMaster = isMasterRole(roleString, null);
    let finalEmpresaId = null;

    if (isMaster) {
      if (empresa_id != null) {
        const empresaOk = await ensureEmpresaExists(connection, empresa_id);
        if (!empresaOk) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ message: "empresa_id inválido" });
        }
        finalEmpresaId = Number(empresa_id);
      }
    } else {
      if (empresa_id == null) {
        await connection.rollback();
        connection.release();
        return res
          .status(400)
          .json({ message: "empresa_id é obrigatório para este perfil de usuário" });
      }
      const empresaOk = await ensureEmpresaExists(connection, empresa_id);
      if (!empresaOk) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: "empresa_id inválido" });
      }
      finalEmpresaId = Number(empresa_id);
    }

    // Inserir usuário com role_id e empresa_id (sempre tentar inserir ambos)
    try {
      // Tentar inserir com role_id primeiro
      const [userResult] = await connection.query(
        `
          INSERT INTO users (name, email, password, role, role_id, empresa_id, must_set_password)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [name, email, hashedPassword, roleString, roleId, finalEmpresaId, mustSetPassword]
      );
      userId = userResult.insertId;
    } catch (insertErr) {
      // Se falhar por conta de role_id (ambiente legado), tentar sem role_id
      if (
        insertErr.code === "ER_BAD_FIELD_ERROR" &&
        insertErr.message &&
        insertErr.message.includes("role_id")
      ) {
        console.warn("Coluna role_id não existe, inserindo sem role_id:", insertErr.message);
        const [userResult] = await connection.query(
          `
          INSERT INTO users (name, email, password, role, empresa_id, must_set_password)
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [name, email, hashedPassword, roleString, finalEmpresaId, mustSetPassword]
        );
        userId = userResult.insertId;
        
        // Tentar atualizar role_id depois (se a coluna existir)
        if (roleId !== null) {
          try {
            await connection.query(
              "UPDATE users SET role_id = ? WHERE id = ?",
              [roleId, userId]
            );
          } catch (updateErr) {
            console.warn("Não foi possível atualizar role_id:", updateErr.message);
          }
        }
      } else {
        throw insertErr; // Re-throw se for outro erro
      }
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
      const baseUrl = process.env.FRONT_URL || "http://localhost:3000";
      const link = `${baseUrl}/definir-senha?token=${token}`;
      const defaultCompanyName = process.env.COMPANY_NAME || "Campauto";

      let empresaContext = {
        companyName: defaultCompanyName,
        companyLogo: null,
      };

      if (req.user?.userId) {
        try {
          const [rowsEmpresa] = await pool.query(
            `
              SELECT e.id, e.nome_fantasia, e.razao_social, e.cnpj,
                     e.endereco, e.cidade, e.estado, e.telefone, e.logo_url
              FROM users u
              LEFT JOIN empresas e ON e.id = u.empresa_id
              WHERE u.id = ?
            `,
            [req.user.userId]
          );
          if (rowsEmpresa[0]) {
            empresaContext = buildEmpresaContextFromRow(rowsEmpresa[0]);
          }
        } catch (ctxErr) {
          console.warn("Falha ao carregar empresa do usuário para FIRST_ACCESS:", ctxErr.message);
        }
      }

      const logoUrl = empresaContext.companyLogo;
      const logoAttachment = await loadLogo({ logoUrl });

      const template = await getTemplate(req.user?.userId, "FIRST_ACCESS");
      const { subject, html } = renderWithData(template, {
        user_name: name,
        user_email: email,
        action_url: link,
        token_expires_in: "1 hora",
        company_name: empresaContext.companyName,
        company_logo: logoAttachment ? "cid:company-logo" : "",
        company_header_html: buildCompanyHeaderHtml(empresaContext.companyName, !!logoAttachment),
      });

      await sendEmailWithInlineLogo(email, subject, html, { logoAttachment });
    } catch (err) {
      return res.status(201).json({
        id: userId,
        message: "Usuário criado, mas falha ao enviar e-mail de boas-vindas.",
      });
    }
  }

  // Garantir que roleString está definido (fallback de segurança)
  const finalRole = roleString || role || "USER";
  
  return res.status(201).json({
    id: userId,
    name,
    email,
    role: finalRole,
    message: "Usuário criado com sucesso",
  });
}

async function updateUser(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid id' });

  const { name, email, password, role, employee = {}, empresa_id } = req.body || {};
  const { full_name, phone } = employee;

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    const [rows] = await connection.query(
      'SELECT id, role, role_id, empresa_id FROM users WHERE id = ?',
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
    let targetRoleUpper = rows[0].role ? String(rows[0].role).toUpperCase() : "";

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
      targetRoleUpper = String(role).toUpperCase();
    }

    // Validar/atualizar empresa_id de acordo com a role (atual ou nova)
    if (empresa_id !== undefined) {
      const currentRoleId = rows[0].role_id;
      const isMaster = isMasterRole(targetRoleUpper, currentRoleId);

      if (isMaster) {
        // MASTER: empresa_id opcional (pode ser null)
        if (empresa_id != null) {
          const empresaOk = await ensureEmpresaExists(connection, empresa_id);
          if (!empresaOk) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ message: "empresa_id inválido" });
          }
        }
        userUpdates.push('empresa_id = ?');
        userParams.push(empresa_id != null ? Number(empresa_id) : null);
      } else {
        // Não-master: empresa_id obrigatório
        if (empresa_id == null) {
          await connection.rollback();
          connection.release();
          return res
            .status(400)
            .json({ message: "empresa_id é obrigatório para este perfil de usuário" });
        }
        const empresaOk = await ensureEmpresaExists(connection, empresa_id);
        if (!empresaOk) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ message: "empresa_id inválido" });
        }
        userUpdates.push('empresa_id = ?');
        userParams.push(Number(empresa_id));
      }
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

async function listPendingCompanyLinks(req, res) {
  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT id, name, email, role, role_id, empresa_id, created_at
      FROM users
      WHERE (role IS NULL OR UPPER(role) <> 'MASTER')
        AND (role_id IS NULL OR role_id <> 1)
        AND (empresa_id IS NULL)
      ORDER BY created_at DESC, id DESC
    `
  );

  res.json({
    total: rows.length,
    data: rows,
  });
}

async function getPendingCompanyCount(req, res) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM users
      WHERE (role IS NULL OR UPPER(role) <> 'MASTER')
        AND (role_id IS NULL OR role_id <> 1)
        AND (empresa_id IS NULL)
    `
  );

  res.json({ total: Number(row.total || 0) });
}

export {
  list,
  getById,
  createUser,
  updateUser,
  removeUser,
  blockUser,
  resetPasswordUser,
  listPendingCompanyLinks,
  getPendingCompanyCount,
};
