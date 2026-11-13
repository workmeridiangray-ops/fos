// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Flames of Shiva contributors
import http from "node:http";
import sharp from "sharp";
import { find as coordinateTimezones } from "geo-tz";
import { DatabaseSync } from "node:sqlite";
import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { resolve, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApplication } from "./application.js";
import { createSQLStore } from "./sql-store.js";
import { createIntegrations } from "./integrations.js";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataDir = resolve(process.env.DATA_DIR || join(root, "data"));
mkdirSync(join(dataDir, "uploads"), { recursive: true });
const db = new DatabaseSync(join(dataDir, "flames.sqlite"));
db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
db.exec(
  "CREATE TABLE IF NOT EXISTS schema_versions(name TEXT PRIMARY KEY,applied TEXT NOT NULL)",
);
for (const file of readdirSync(join(root, "migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  if (!db.prepare("SELECT name FROM schema_versions WHERE name=?").get(file)) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(readFileSync(join(root, "migrations", file), "utf8"));
      db.prepare("INSERT INTO schema_versions VALUES(?,?)").run(
        file,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

const store = createSQLStore({
  one: (sql, ...args) => db.prepare(sql).get(...args),
  all: (sql, ...args) => db.prepare(sql).all(...args),
  batch: (statements) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = statements.map(([sql, args]) =>
        db.prepare(sql).run(...args),
      );
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  },
});
const rates = new Map();
function rate(key, max = 60) {
  const t = Date.now(),
    r = rates.get(key) || { t, n: 0 };
  if (t - r.t > 60000) {
    r.t = t;
    r.n = 0;
  }
  if (++r.n > max)
    throw Object.assign(new Error("Too many requests. Please wait a minute."), {
      status: 429,
    });
  rates.set(key, r);
  if (rates.size > 5000)
    for (const [k, v] of rates) if (t - v.t > 60000) rates.delete(k);
}

export const server = http.createServer(
  createApplication({
    ...store,
    env: process.env,
    rate,
    integrations: createIntegrations(process.env),
    coordinateTimezones,
    putUpload: (uid, bytes) =>
      writeFileSync(join(dataDir, "uploads", uid), bytes, { mode: 0o600 }),
    readUpload: (uid) => readFileSync(join(dataDir, "uploads", uid)),
    transformImage: (bytes, mime) =>
      sharp(bytes, { limitInputPixels: 40000000 })
        .rotate()
        .resize({
          width: 2500,
          height: 2500,
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFormat(mime === "image/png" ? "png" : "jpeg")
        .toBuffer(),
    serveStatic(req, res) {
      const file = resolve(
        root,
        "public",
        new URL(req.url, "http://localhost").pathname.slice(1),
      );
      if (!file.startsWith(join(root, "public") + "/")) {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end(readFileSync(join(root, "public/index.html")));
      }
      const chosen =
        existsSync(file) && extname(file)
          ? file
          : join(root, "public/index.html");
      const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".webp": "image/webp",
        ".ttf": "font/ttf",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
      };
      res.writeHead(200, {
        "Content-Type": types[extname(chosen)] || "application/octet-stream",
      });
      return res.end(readFileSync(chosen));
    },
  }),
);
if (process.env.NODE_ENV !== "test")
  server.listen(
    Number(process.env.PORT || 3000),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        `Flames of Shiva: http://localhost:${process.env.PORT || 3000}`,
      ),
  );
