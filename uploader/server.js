require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { Blob } = require("buffer");
const express = require("express");
const multer = require("multer");

const app = express();

const PORT = Number(process.env.PORT || 3025);
const UPLOAD_TOKEN = String(process.env.UPLOAD_TOKEN || "");
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 5);
const MAX_FILE_SIZE_BYTES = Math.max(1, MAX_FILE_SIZE_MB) * 1024 * 1024;
const UPLOAD_ADAPTER = normalizeAdapter(process.env.UPLOAD_ADAPTER || "local");
const DISCORD_WEBHOOK_URL = String(process.env.DISCORD_WEBHOOK_URL || "");
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 60);

const allowedMime = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExt = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const rateLimitBuckets = new Map();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter(_req, file, cb) {
    if (!allowedMime.has(file.mimetype)) {
      cb(new UploadError("invalid_mime", 400));
      return;
    }

    const ext = path.extname(file.originalname || "").toLowerCase();
    if (ext && !allowedExt.has(ext)) {
      cb(new UploadError("invalid_extension", 400));
      return;
    }

    cb(null, true);
  },
});

class UploadError extends Error {
  constructor(code, status = 400, details) {
    super(code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function normalizeAdapter(value) {
  const adapter = String(value || "local").toLowerCase();
  if (adapter === "discord" || adapter === "local_discord" || adapter === "local") {
    return adapter;
  }

  return "local";
}

function jsonError(res, error) {
  const status = error && Number(error.status) ? Number(error.status) : 500;
  const code = error && error.code ? error.code : "internal_error";

  if (status >= 500) {
    console.error("[mz-phone-uploader]", code, error && error.stack ? error.stack : error);
  }

  res.status(status).json({
    success: false,
    error: code,
  });
}

function requireToken(req, res, next) {
  if (!UPLOAD_TOKEN) {
    jsonError(res, new UploadError("upload_token_not_configured", 500));
    return;
  }

  const provided = String(req.get("x-upload-token") || req.query.token || "");
  if (provided !== UPLOAD_TOKEN) {
    jsonError(res, new UploadError("invalid_upload_token", 401));
    return;
  }

  next();
}

function rateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  bucket.count += 1;
  rateLimitBuckets.set(ip, bucket);

  if (bucket.count > RATE_LIMIT_MAX) {
    jsonError(res, new UploadError("rate_limited", 429));
    return;
  }

  next();
}

function detectImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: ".jpg" };
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", ext: ".png" };
  }

  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", ext: ".webp" };
  }

  return null;
}

function getUploadedFile(req) {
  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) {
    throw new UploadError("file_required", 400);
  }

  const file = files[0];
  const detected = detectImage(file.buffer);
  if (!detected) {
    throw new UploadError("invalid_image_signature", 400);
  }

  if (detected.mime !== file.mimetype) {
    throw new UploadError("mime_signature_mismatch", 400);
  }

  return {
    buffer: file.buffer,
    mime: detected.mime,
    ext: detected.ext,
    size: file.size,
  };
}

function publicUploadUrl(relativePath) {
  if (!PUBLIC_BASE_URL) {
    throw new UploadError("public_base_url_not_configured", 500);
  }

  return `${PUBLIC_BASE_URL}/${relativePath.replace(/\\/g, "/").replace(/^\/+/, "")}`;
}

async function saveLocal(file) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const folder = path.join(UPLOAD_DIR, "phone", year, month);
  const fileName = `${Date.now()}-${crypto.randomUUID()}${file.ext}`;
  const diskPath = path.join(folder, fileName);

  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(diskPath, file.buffer, { flag: "wx" });

  const relativePath = path.posix.join("uploads", "phone", year, month, fileName);
  const url = publicUploadUrl(relativePath);

  return {
    url,
    localUrl: url,
    path: relativePath,
    size: file.size,
  };
}

function withDiscordWait(webhookUrl) {
  const url = new URL(webhookUrl);
  url.searchParams.set("wait", "true");
  return url.toString();
}

async function uploadDiscord(file) {
  if (!DISCORD_WEBHOOK_URL) {
    throw new UploadError("discord_webhook_not_configured", 500);
  }

  const fileName = `mz-phone-${Date.now()}-${crypto.randomUUID()}${file.ext}`;
  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      content: "mz_phone camera upload",
      allowed_mentions: { parse: [] },
    }),
  );
  form.append("files[0]", new Blob([file.buffer], { type: file.mime }), fileName);

  const response = await fetch(withDiscordWait(DISCORD_WEBHOOK_URL), {
    method: "POST",
    body: form,
  });

  const text = await response.text();
  let body = {};

  if (text) {
    try {
      body = JSON.parse(text);
    } catch (_) {
      body = {};
    }
  }

  if (!response.ok) {
    throw new UploadError("discord_upload_failed", 502, body);
  }

  const attachment = Array.isArray(body.attachments) ? body.attachments[0] : null;
  const discordUrl = attachment && typeof attachment.url === "string" ? attachment.url : "";

  if (!discordUrl) {
    throw new UploadError("discord_url_not_found", 502, body);
  }

  return {
    url: discordUrl,
    discordUrl,
    discordMessageId: String(body.id || ""),
    discordChannelId: String(body.channel_id || ""),
  };
}

async function handleUpload(req, res) {
  const file = getUploadedFile(req);

  if (UPLOAD_ADAPTER === "discord") {
    const discord = await uploadDiscord(file);
    res.json({
      success: true,
      adapter: "discord",
      url: discord.discordUrl,
      discordUrl: discord.discordUrl,
      discordMessageId: discord.discordMessageId,
      discordChannelId: discord.discordChannelId,
    });
    return;
  }

  if (UPLOAD_ADAPTER === "local_discord") {
    const local = await saveLocal(file);
    const payload = {
      success: true,
      adapter: "local_discord",
      url: local.localUrl,
      localUrl: local.localUrl,
      path: local.path,
    };

    try {
      const discord = await uploadDiscord(file);
      payload.discordUrl = discord.discordUrl;
      payload.discordMessageId = discord.discordMessageId;
      payload.discordChannelId = discord.discordChannelId;
    } catch (error) {
      payload.warning = "discord_upload_failed";
      console.error("[mz-phone-uploader] discord_upload_failed", error && error.message ? error.message : error);
    }

    res.json(payload);
    return;
  }

  const local = await saveLocal(file);
  res.json({
    success: true,
    adapter: "local",
    url: local.localUrl,
    localUrl: local.localUrl,
    path: local.path,
  });
}

app.disable("x-powered-by");
app.set("trust proxy", true);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "mz-phone-uploader",
    adapter: UPLOAD_ADAPTER,
    maxFileSizeMb: MAX_FILE_SIZE_MB,
  });
});

app.post(
  "/api/mz-phone/upload",
  rateLimit,
  requireToken,
  upload.any(),
  async (req, res) => {
    try {
      await handleUpload(req, res);
    } catch (error) {
      jsonError(res, error);
    }
  },
);

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    jsonError(res, new UploadError(error.code || "upload_failed", 400));
    return;
  }

  jsonError(res, error);
});

app.listen(PORT, () => {
  console.log(`[mz-phone-uploader] listening on :${PORT} adapter=${UPLOAD_ADAPTER}`);
});
