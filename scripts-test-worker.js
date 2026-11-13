// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Flames of Shiva contributors
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import net from "node:net";

// Isolated local bindings and disposable fixture secrets. No remote resources
// are touched and this generated test configuration is never deployed.
const root = process.cwd();
const scratch = mkdtempSync(join(tmpdir(), "flames-worker-test-"));
const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
config.main = resolve(root, config.main);
config.assets.directory = resolve(root, config.assets.directory);
config.d1_databases[0].migrations_dir = resolve(root, "migrations");
config.vars = {
  ADMIN_EMAIL: "admin@example.test",
  STRIPE_WEBHOOK_SECRET: "test-webhook-secret",
};
config.observability = { enabled: false };
const configPath = join(scratch, "wrangler.json");
writeFileSync(configPath, JSON.stringify(config));
const statePath = join(scratch, "state");
const env = {
  ...process.env,
  WRANGLER_SEND_METRICS: "false",
  WRANGLER_REGISTRY_PATH: join(scratch, "registry"),
  WRANGLER_LOG_PATH: join(scratch, "logs"),
};
const cli = resolve(root, "node_modules/wrangler/bin/wrangler.js");
let dev;
try {
  const migration = spawnSync(
    process.execPath,
    [
      cli,
      "d1",
      "migrations",
      "apply",
      "flames-of-shiva",
      "--local",
      "--config",
      configPath,
      "--persist-to",
      statePath,
    ],
    { env, encoding: "utf8" },
  );
  if (migration.status !== 0) throw Error(migration.stdout + migration.stderr);
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
  const base = `http://127.0.0.1:${port}`;
  dev = spawn(
    process.execPath,
    [
      cli,
      "dev",
      "--local",
      "--config",
      configPath,
      "--persist-to",
      statePath,
      "--port",
      String(port),
    ],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let logs = "";
  dev.stdout.on("data", (c) => {
    logs += c;
  });
  dev.stderr.on("data", (c) => {
    logs += c;
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (dev.exitCode !== null) throw Error(logs);
    try {
      if ((await fetch(base + "/api/me")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(100);
  }
  if (!ready) throw Error("Local Worker did not start:\n" + logs);
  const code = await new Promise((resolve, reject) => {
    const tests = spawn(
      process.execPath,
      [
        "--test",
        "--test-concurrency=1",
        "tests/workflows.test.js",
        "tests/sql-store.test.js",
      ],
      {
        env: {
          ...env,
          TEST_WORKER_URL: base,
          TEST_WORKER_CONFIG: configPath,
          TEST_WORKER_STATE: join(statePath, "v3"),
        },
        stdio: "inherit",
      },
    );
    tests.on("error", reject);
    tests.on("exit", resolve);
  });
  process.exitCode = code || 0;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (dev && dev.exitCode === null) {
    const exited = new Promise((r) => dev.once("exit", r));
    dev.kill("SIGTERM");
    await exited;
  }
  rmSync(scratch, { recursive: true, force: true });
}
