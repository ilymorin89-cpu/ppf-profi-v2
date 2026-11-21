import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProjectRelativePath, isPathWithinRoot, isAllowedProjectExtension } from "../scripts/agent-hq-file-policy.mjs";

test("normalizes Windows separators to project-relative POSIX paths", () => {
  assert.equal(normalizeProjectRelativePath("src\\app\\page.tsx"), "src/app/page.tsx");
});

test("rejects absolute, traversal, empty, dot, NUL and protected paths", () => {
  for (const value of [
    "/etc/passwd", "C:\\Windows\\win.ini", "../outside.txt",
    "src/../outside.txt", "src//page.tsx", "./page.tsx",
    "src/.git/config", "node_modules/pkg/index.js",
    "secrets/api.json", "src/.env.local", "src/private-key.txt",
    "src/token.json", "src/credential.md", "src/secret-notes.txt",
    "src\\..\\outside.txt", "src\\file\0.txt", ""
  ]) {
    assert.throws(() => normalizeProjectRelativePath(value), undefined, value);
  }
});

test("allows only text-oriented project extensions", () => {
  for (const path of ["README.md", "src/index.ts", "db/migration.sql", "config.yml"]) {
    assert.equal(isAllowedProjectExtension(path), true);
  }
  for (const path of ["image.png", "archive.zip", "binary.exe", "unknown"]) {
    assert.equal(isAllowedProjectExtension(path), false);
  }
});

test("checks resolved paths against root without prefix-confusion", () => {
  assert.equal(isPathWithinRoot("/srv/project", "/srv/project/src/index.ts"), true);
  assert.equal(isPathWithinRoot("/srv/project", "/srv/project"), true);
  assert.equal(isPathWithinRoot("/srv/project", "/srv/project-secrets/key.txt"), false);
  assert.equal(isPathWithinRoot("/srv/project", "/srv/other/file.txt"), false);
});
