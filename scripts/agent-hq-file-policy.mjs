import { relative, isAbsolute, resolve } from "node:path";

const blockedDirectories = new Set([
  ".git", "node_modules", ".next", ".vercel", "secrets", "credentials"
]);
const allowedExtensions = new Set([
  ".md", ".mjs", ".js", ".ts", ".tsx", ".json", ".sql", ".yml", ".yaml", ".txt", ".css"
]);

export function normalizeProjectRelativePath(input) {
  if (typeof input !== "string" || !input.trim() || input.includes("\0")) {
    throw new Error("Project file read is not permitted");
  }
  const normalized = input.replaceAll("\\", "/");
  const parts = normalized.split("/");
  const filename = parts.at(-1) || "";
  if (
    normalized.startsWith("/") ||
    parts.some(part => !part || part === "." || part === ".." || blockedDirectories.has(part.toLowerCase()) || /(^|[._-])(env|secret|credential|private|token|key)([._-]|$)/i.test(part)) ||
    /^[a-z]:\//i.test(normalized) ||
    /(^|[._-])(env|secret|credential|private|token|key)([._-]|$)/i.test(filename)
  ) {
    throw new Error("Project file path is outside the permitted read-only file policy");
  }
  return normalized;
}

export function isPathWithinRoot(root, candidate) {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\\\" : "/"}`));
}

export function isAllowedProjectExtension(pathname) {
  const name = pathname.toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot >= 0 && allowedExtensions.has(name.slice(dot));
}
