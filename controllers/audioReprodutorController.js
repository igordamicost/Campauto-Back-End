import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../src/config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_BASE = path.join(__dirname, "..");
const UPLOAD_DIR = path.join(UPLOAD_BASE, "uploads/audio-reprodutor");
const LIMIT_BYTES = 7_368_709_120; // 7 GB (7.368.709.120 bytes)

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

async function getTotalSizeBytes() {
  const [[row]] = await db.query(
    "SELECT COALESCE(SUM(size_bytes), 0) AS total FROM audio_reprodutor_files"
  );
  return Number(row?.total ?? 0);
}

async function listFiles(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT id, filename, size_bytes, duration_seconds, created_at
       FROM audio_reprodutor_files
       ORDER BY created_at DESC`
    );
    const totalSize = await getTotalSizeBytes();
    const files = rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      size_bytes: r.size_bytes,
      duration_seconds: r.duration_seconds,
      created_at: r.created_at,
      url: `/audio-reprodutor/files/${r.id}/stream`,
    }));
    return res.json({
      files,
      total_size_bytes: totalSize,
      limit_bytes: LIMIT_BYTES,
      usage_percent: Number(((totalSize / LIMIT_BYTES) * 100).toFixed(2)),
    });
  } catch (error) {
    console.error("audioReprodutor listFiles:", error);
    return res.status(500).json({ message: "Erro ao listar arquivos" });
  }
}

async function uploadFiles(req, res) {
  try {
    let files = [];
    if (req.files) {
      const f = req.files;
      files = [].concat(
        Array.isArray(f.file) ? f.file : f.file ? [f.file] : [],
        Array.isArray(f.files) ? f.files : f.files ? [f.files] : []
      );
    } else if (req.file) {
      files = [req.file];
    }
    if (!files.length) {
      return res.status(400).json({ message: "Nenhum arquivo enviado" });
    }

    const invalid = files.filter((f) => {
      const ext = path.extname(f.originalname || f.name || "").toLowerCase();
      return ext !== ".wav";
    });
    if (invalid.length) {
      return res.status(400).json({
        message: "Apenas arquivos .wav são permitidos",
      });
    }

    const totalSize = await getTotalSizeBytes();
    const newSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
    if (totalSize + newSize > LIMIT_BYTES) {
      return res.status(400).json({
        message: `Limite de 7 GB excedido. Total atual: ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`,
      });
    }

    ensureUploadDir();
    const uploaded = [];

    for (const file of files) {
      const filename = file.originalname || file.name || `audio_${Date.now()}.wav`;
      const safeName = `${Date.now()}_${path.basename(filename, ".wav")}.wav`;
      const filePath = path.join(UPLOAD_DIR, safeName);
      const relativePath = path.join("uploads", "audio-reprodutor", safeName);

      if (file.buffer) {
        fs.writeFileSync(filePath, file.buffer);
      } else if (file.path && fs.existsSync(file.path)) {
        fs.renameSync(file.path, filePath);
      } else {
        continue;
      }

      const sizeBytes = fs.statSync(filePath).size;
      const [result] = await db.query(
        `INSERT INTO audio_reprodutor_files (filename, file_path, size_bytes, duration_seconds)
         VALUES (?, ?, ?, NULL)`,
        [filename, relativePath, sizeBytes]
      );

      uploaded.push({
        id: result.insertId,
        filename,
        size_bytes: sizeBytes,
      });
    }

    const newTotal = await getTotalSizeBytes();
    return res.status(201).json({
      uploaded,
      total_size_bytes: newTotal,
      limit_bytes: LIMIT_BYTES,
    });
  } catch (error) {
    console.error("audioReprodutor upload:", error);
    return res.status(500).json({ message: "Erro ao fazer upload" });
  }
}

async function deleteFile(req, res) {
  try {
    const id = Number(req.params.id);
    const [[row]] = await db.query(
      "SELECT id, file_path FROM audio_reprodutor_files WHERE id = ?",
      [id]
    );
    if (!row) {
      return res.status(404).json({ message: "Arquivo não encontrado" });
    }

    await db.query("DELETE FROM audio_reprodutor_files WHERE id = ?", [id]);
    const fullPath = row.file_path?.startsWith("/")
      ? row.file_path
      : path.join(UPLOAD_BASE, row.file_path || "");
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return res.json({ message: "Deleted" });
  } catch (error) {
    console.error("audioReprodutor delete:", error);
    return res.status(500).json({ message: "Erro ao excluir" });
  }
}

async function streamFile(req, res) {
  try {
    const id = Number(req.params.id);
    const [[row]] = await db.query(
      "SELECT id, file_path, filename FROM audio_reprodutor_files WHERE id = ?",
      [id]
    );
    const fullPath = row?.file_path?.startsWith("/")
      ? row.file_path
      : path.join(UPLOAD_BASE, row?.file_path || "");
    if (!row || !fs.existsSync(fullPath)) {
      return res.status(404).json({ message: "Arquivo não encontrado" });
    }

    const stat = fs.statSync(fullPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader("Content-Type", "audio/wav");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", chunkSize);

      const stream = fs.createReadStream(fullPath, { start, end });
      stream.pipe(res);
    } else {
      res.setHeader("Content-Length", fileSize);
      res.setHeader("Accept-Ranges", "bytes");
      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
    }
  } catch (error) {
    console.error("audioReprodutor stream:", error);
    res.status(500).json({ message: "Erro ao reproduzir" });
  }
}

async function getHistory(req, res) {
  try {
    const userId = req.user.userId ?? req.user.id;
    const [rows] = await db.query(
      `SELECT h.file_id, f.filename, h.position_seconds, f.duration_seconds AS duration_seconds,
              h.is_finished, h.annotations, h.updated_at
       FROM audio_reprodutor_history h
       INNER JOIN audio_reprodutor_files f ON f.id = h.file_id
       WHERE h.user_id = ?
       ORDER BY h.updated_at DESC`,
      [userId]
    );
    const history = rows.map((r) => ({
      file_id: r.file_id,
      filename: r.filename,
      position_seconds: r.position_seconds,
      duration_seconds: r.duration_seconds,
      is_finished: Boolean(r.is_finished),
      annotations: r.annotations,
      updated_at: r.updated_at,
    }));
    return res.json({ history });
  } catch (error) {
    console.error("audioReprodutor history:", error);
    return res.status(500).json({ message: "Erro ao buscar histórico" });
  }
}

async function updateHistory(req, res) {
  try {
    const userId = req.user.userId ?? req.user.id;
    const fileId = Number(req.params.fileId);
    const { position_seconds, is_finished, annotations } = req.body || {};

    const [[exists]] = await db.query(
      "SELECT id FROM audio_reprodutor_files WHERE id = ?",
      [fileId]
    );
    if (!exists) {
      return res.status(404).json({ message: "Arquivo não encontrado" });
    }

    const updates = [];
    const params = [];

    if (position_seconds !== undefined) {
      updates.push("position_seconds = ?");
      params.push(Math.max(0, Number(position_seconds) || 0));
    }
    if (is_finished !== undefined) {
      updates.push("is_finished = ?");
      params.push(is_finished ? 1 : 0);
    }
    if (annotations !== undefined) {
      updates.push("annotations = ?");
      params.push(String(annotations || "").trim() || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    const insertParams = [
      userId,
      fileId,
      position_seconds ?? 0,
      is_finished ? 1 : 0,
      annotations ?? null,
    ];

    await db.query(
      `INSERT INTO audio_reprodutor_history (user_id, file_id, position_seconds, is_finished, annotations)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE ${updates.join(", ")}`,
      [...insertParams, ...params]
    );

    return res.json({ message: "Updated" });
  } catch (error) {
    console.error("audioReprodutor updateHistory:", error);
    return res.status(500).json({ message: "Erro ao atualizar" });
  }
}

async function getStats(req, res) {
  try {
    const totalSize = await getTotalSizeBytes();
    const [[countRow]] = await db.query(
      "SELECT COUNT(*) AS count FROM audio_reprodutor_files"
    );
    return res.json({
      total_size_bytes: totalSize,
      limit_bytes: LIMIT_BYTES,
      usage_percent: Number(((totalSize / LIMIT_BYTES) * 100).toFixed(2)),
      file_count: Number(countRow?.count ?? 0),
    });
  } catch (error) {
    console.error("audioReprodutor stats:", error);
    return res.status(500).json({ message: "Erro ao buscar estatísticas" });
  }
}

export {
  listFiles,
  uploadFiles,
  deleteFile,
  streamFile,
  getHistory,
  updateHistory,
  getStats,
};
