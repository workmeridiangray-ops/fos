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
  "package.json",
  "package-lock.json",
  ".env.example",
  "wrangler.jsonc",
])
  cpSync(f, "dist/" + f, { recursive: true });
console.log(
  "Deployment bundle prepared in dist. Runtime: Node 24 with persistent disk; run npm ci then npm start.",
);
