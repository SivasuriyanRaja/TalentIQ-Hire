import { inflateRawSync } from "node:zlib";
import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";
import type { Request, Response, NextFunction } from "express";

export const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".txt"]);
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_TEXT_CHARS = 200_000;

export const MAGIC_BYTES: Record<string, Buffer> = {
  pdf: Buffer.from("%PDF", "utf-8"),
  docx: Buffer.from("PK\x03\x04", "utf-8"),
  doc: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),
};

export function detectKind(buffer: Buffer): "pdf" | "docx" | "doc" | "text" | "unknown" {
  if (buffer.length < 4) return "unknown";
  if (buffer.subarray(0, 4).equals(MAGIC_BYTES.pdf)) return "pdf";
  if (buffer.subarray(0, 4).equals(MAGIC_BYTES.docx)) return "docx";
  if (buffer.subarray(0, 4).equals(MAGIC_BYTES.doc)) return "doc";
  let valid = true;
  for (let i = 0; i < Math.min(buffer.length, 512); i++) {
    const b = buffer[i];
    if (b === 0) { valid = false; break; }
    if (b < 0x09 || ((b > 0x0d && b < 0x20) && b !== 0x0b)) { valid = false; break; }
  }
  return valid ? "text" : "unknown";
}

export function magicMatches(ext: string, kind: string): boolean {
  const e = ext.toLowerCase();
  if (e === ".pdf") return kind === "pdf";
  if (e === ".docx") return kind === "docx";
  if (e === ".doc") return kind === "doc";
  if (e === ".txt") return kind === "text";
  return false;
}

function parseZip(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (
      buffer[i] === 0x50 &&
      buffer[i + 1] === 0x4b &&
      buffer[i + 2] === 0x05 &&
      buffer[i + 3] === 0x06
    ) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return files;

  const cdOffset = buffer.readUInt32LE(eocd + 16);
  const cdEntries = buffer.readUInt16LE(eocd + 10);
  let p = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(p + 10);
    const csize = buffer.readUInt32LE(p + 20);
    const coffset = buffer.readUInt32LE(p + 42);
    const nameLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const commentLen = buffer.readUInt16LE(p + 32);
    const name = buffer.subarray(p + 46, p + 46 + nameLen).toString("utf-8");
    p += 46 + nameLen + extraLen + commentLen;

    const lnameLen = buffer.readUInt16LE(coffset + 26);
    const lextraLen = buffer.readUInt16LE(coffset + 28);
    const dataStart = coffset + 30 + lnameLen + lextraLen;
    const raw = buffer.subarray(dataStart, dataStart + csize);
    const content = method === 8 ? inflateRawSync(raw) : raw;
    files.set(name, content);
  }
  return files;
}

function readDocxText(filePath: string): string {
  try {
    const buffer = fs.readFileSync(filePath);
    const files = parseZip(buffer);
    const xml = files.get("word/document.xml");
    if (!xml) return "";
    const text = xml
      .toString("utf-8")
      .replace(/<w:br[^\/]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, (_match, group) => group)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, MAX_TEXT_CHARS);
  } catch {
    return "";
  }
}

export async function readFileText(filePath: string, ext: string): Promise<string> {
  const e = ext.toLowerCase();
  if (e === ".txt") {
    try {
      return fs.readFileSync(filePath, "utf-8").slice(0, MAX_TEXT_CHARS);
    } catch {
      return "";
    }
  }
  if (e === ".pdf") {
    try {
      const mod = await import("pdf-parse");
      const pdfParse = mod.default ?? mod;
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer as Buffer);
      return (data.text ?? "").slice(0, MAX_TEXT_CHARS);
    } catch {
      return "";
    }
  }
  if (e === ".docx") return readDocxText(filePath);
  return "";
}

import os from "node:os";
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir =
      process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
        ? path.join(os.tmpdir(), "uploads", "resumes")
        : path.join(process.cwd(), "uploads", "resumes");
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const uid = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    cb(null, `${uid}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, Word (.doc, .docx), and plain-text (.txt) files are accepted."));
    }
  },
});

export function handleResumeUpload(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  upload.single("resume")(req as any, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Resume file exceeds the 5 MB limit." });
        return;
      }
      res.status(400).json({ error: err.message || "Invalid resume upload." });
      return;
    }
    next();
  });
}

export function validateResumeMagic(filePath: string, ext: string): void {
  const fd = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(4);
    fs.readSync(fd, header, 0, 4, 0);
    if (!magicMatches(ext, detectKind(header))) {
      throw new Error("File contents do not match the declared file type.");
    }
  } finally {
    fs.closeSync(fd);
  }
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 260);
}

