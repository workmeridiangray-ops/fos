// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Flames of Shiva contributors
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
execFileSync(process.execPath, ["--check", "src/server.js"], {
  stdio: "inherit",
});
execFileSync(process.execPath, ["--check", "public/app.js"], {
  stdio: "inherit",
});
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
for (const f of [
  "public",
  "src",
  "migrations",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "third_party",
  "package.json",
  "package-lock.json",
  ".env.example",
  "chart-service",
  "docs/kundli-integration.md",
  "docs/kundli-cloudrun.md",
  "docs/kundli-completion.md",
  "scripts-deploy-chart-cloudrun.py",
  "wrangler.jsonc",
])
  cpSync(f, "dist/" + f, {
    recursive: true,
    filter: (source) =>
      !/(^|[/\\])(?:__pycache__|\.pytest_cache|\.venv)(?:[/\\]|$)/.test(
        source,
      ) &&
      !source.endsWith(".pyc") &&
      !source.endsWith("/.env"),
  });
console.log(
  "Deployment bundle prepared in dist. Runtime: Node 24 with persistent disk; run npm ci then npm start.",
);
