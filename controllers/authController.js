import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getPool } from "../db.js";
import { RBACRepository } from "../src/repositories/rbac.repository.js";
import { MenuRepository } from "../src/repositories/menu.repository.js";
import {
  createSession,
  ACCESS_TTL_MIN,
} from "../src/services/sessionStore.service.js";
import {
  getRefreshCookieOptions,
  getClearCookieOptions,
  COOKIE_NAME as COOKIE_NAME_CONFIG,
} from "../src/config/authCookies.js";
import {
  validateRefreshToken,
  rotateRefreshToken,
  revokeSession,
} from "../src/services/sessionStore.service.js";

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, name, email, role_id, empresa_id, password, blocked
     FROM users WHERE email = ? LIMIT 1`,
    [email]
  );

  const user = rows[0];
  const invalidCreds = { message: "E-mail ou senha incorretos" };
  if (!user) return res.status(401).json(invalidCreds);
  if (user.blocked) return res.status(403).json({ message: "Conta bloqueada" });
  if (!user.password) return res.status(403).json({ message: "Defina sua senha primeiro (verifique o e-mail)" });

  let ok = false;
  if (user.password && user.password.startsWith("$2")) {
    ok = await bcrypt.compare(password, user.password);
  } else {
    const hash = crypto.createHash("sha256").update(password).digest("hex");
    ok = hash === user.password;
  }

  if (!ok) return res.status(401).json(invalidCreds);

  const meta = {
    userAgent: req.headers["user-agent"],
    ip: req.ip || req.connection?.remoteAddress,
  };
  const { sessionId, refreshToken } = await createSession(user.id, meta);

  const accessToken = jwt.sign(
    {
      userId: user.id,
      roleId: user.role_id,
      empresaId: user.empresa_id ?? null,
      sessionId,
    },
    process.env.JWT_SECRET,
    { expiresIn: `${ACCESS_TTL_MIN}m` }
  );

  res.cookie(COOKIE_NAME_CONFIG, refreshToken, getRefreshCookieOptions());
  return res.json({ token: accessToken });
}

async function getMe(req, res) {
  try {
    const userId = req.user.userId;
    const userWithPermissions = await RBACRepository.getUserWithPermissions(userId);

    if (!userWithPermissions) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const roleName = String(userWithPermissions.role_name || "").toUpperCase();
    const isDev = roleName === "DEV";

    let menu = [];
    try {
      const allItems = await MenuRepository.getAll();
      let filtered;
      if (isDev) {
        filtered = allItems;
      } else {
        const permSet = new Set(userWithPermissions.permissions || []);
        filtered = allItems.filter((item) => !item.permission || permSet.has(item.permission));
      }
      const tree = buildMenuTree(filtered, null);
      menu = pruneEmptyParents(tree);
    } catch (menuErr) {
      if (menuErr.code !== "ER_NO_SUCH_TABLE") console.warn("getMe menu:", menuErr.message);
    }

    const response = {
      user: {
        id: userWithPermissions.id,
        name: userWithPermissions.name,
        email: userWithPermissions.email,
        role: {
          id: userWithPermissions.role_id,
          name: userWithPermissions.role_name,
          description: userWithPermissions.role_description,
        },
      },
      modules: (userWithPermissions.modules || []).map((m) => ({
        id: m.id,
        key: m.key,
        label: m.label,
        icon: m.icon ?? null,
        order: m.order ?? 0,
      })),
      permissions: userWithPermissions.permissions,
      permissionsDetail: userWithPermissions.permissionsDetail,
      menu,
    };

    return res.json(response);
  } catch (error) {
    console.error('Error in getMe:', error);
    return res.status(500).json({ message: 'Erro ao buscar dados do usuário' });
  }
}

function buildMenuTree(items, parentId) {
  return items
    .filter((i) => (parentId == null ? !i.parent_id : i.parent_id === parentId))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((item) => ({
      id: item.id,
      parent_id: item.parent_id,
      module_key: item.module_key,
      label: item.label,
      path: item.path,
      icon: item.icon,
      order: item.order,
      permission: item.permission,
      permission_create: item.permission_create,
      permission_update: item.permission_update,
      permission_update_partial: item.permission_update_partial,
      permission_delete: item.permission_delete,
      children: buildMenuTree(items, item.id),
    }));
}

/** Remove pais sem filhos e sem path próprio (menu colapsável vazio) */
function pruneEmptyParents(tree) {
  return tree
    .map((item) => {
      if (item.children && item.children.length > 0) {
        item.children = pruneEmptyParents(item.children);
      }
      return item;
    })
    .filter((item) => {
      const hasChildren = item.children && item.children.length > 0;
      const hasPath = item.path != null && String(item.path).trim() !== "";
      return hasChildren || hasPath;
    });
}

async function refresh(req, res) {
  const refreshToken = req.cookies?.[COOKIE_NAME_CONFIG];
  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token ausente" });
  }

  const result = await validateRefreshToken(refreshToken);
  if (!result.valid) {
    res.clearCookie(COOKIE_NAME_CONFIG, getClearCookieOptions());
    if (result.revokeFamily) {
      return res.status(401).json({ message: "Sessão revogada por segurança (replay detectado)" });
    }
    return res.status(401).json({ message: "Refresh token inválido ou expirado" });
  }

  const oldHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const rotated = await rotateRefreshToken(result.session.id, oldHash);
  if (!rotated) {
    res.clearCookie(COOKIE_NAME_CONFIG, getClearCookieOptions());
    return res.status(401).json({ message: "Falha na rotação do token" });
  }

  const [userRows] = await getPool().query(
    "SELECT id, role_id, empresa_id FROM users WHERE id = ?",
    [result.session.user_id]
  );
  const user = userRows[0];
  if (!user) {
    res.clearCookie(COOKIE_NAME_CONFIG, getClearCookieOptions());
    return res.status(401).json({ message: "Usuário não encontrado" });
  }

  const accessToken = jwt.sign(
    {
      userId: user.id,
      roleId: user.role_id,
      empresaId: user.empresa_id ?? null,
      sessionId: result.session.id,
    },
    process.env.JWT_SECRET,
    { expiresIn: `${ACCESS_TTL_MIN}m` }
  );

  res.cookie(COOKIE_NAME_CONFIG, rotated.refreshToken, getRefreshCookieOptions());
  return res.json({ token: accessToken });
}

async function logout(req, res) {
  const sessionId = req.user?.sessionId;
  if (sessionId) {
    await revokeSession(sessionId);
  }
  res.clearCookie(COOKIE_NAME_CONFIG, getClearCookieOptions());
  return res.json({ message: "Logout realizado" });
}

export { login, getMe, refresh, logout };
