// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Flames of Shiva contributors
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createSQLStore } from "../src/sql-store.js";
async function setup() {
  if (process.env.TEST_WORKER_URL) {
    const { getPlatformProxy } = await import("wrangler");
    const proxy = await getPlatformProxy({
      configPath: process.env.TEST_WORKER_CONFIG,
      persist: { path: process.env.TEST_WORKER_STATE },
    });
    const db = proxy.env.DB;
    await db.batch([
      db.prepare(
        "CREATE TABLE IF NOT EXISTS stock(id INTEGER PRIMARY KEY,quantity INTEGER CHECK(quantity>=0))",
      ),
      db.prepare("DELETE FROM stock"),
      db.prepare("INSERT INTO stock VALUES(1,2)"),
    ]);
    const store = createSQLStore({
      one: (sql, ...args) =>
        db
          .prepare(sql)
          .bind(...args)
          .first(),
      all: async (sql, ...args) =>
        (
          await db
            .prepare(sql)
            .bind(...args)
            .all()
        ).results,
      batch: async (items) =>
        (
          await db.batch(
            items.map(([sql, args]) => db.prepare(sql).bind(...args)),
          )
        ).map((r) => r.meta),
    });
    return { ...store, close: () => proxy.dispose() };
  }
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("../migrations/005_atomic_batches.sql", import.meta.url),
      "utf8",
    ),
  );
  db.exec(
    "CREATE TABLE stock(id INTEGER PRIMARY KEY,quantity INTEGER CHECK(quantity>=0)); INSERT INTO stock VALUES(1,2)",
  );
  const store = createSQLStore({
    one: (sql, ...args) => db.prepare(sql).get(...args),
    all: (sql, ...args) => db.prepare(sql).all(...args),
    batch: (items) => {
      db.exec("BEGIN");
      try {
        const results = items.map(([sql, args]) =>
          db.prepare(sql).run(...args),
        );
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  });
  return { ...store, close: () => db.close() };
}
test("concurrent reservations retry stale snapshots without overselling", async () => {
  const store = await setup();
  try {
    let attempts = 0;
    const reserve = () =>
      store.transaction(async () => {
        attempts++;
        const row = await store.one("SELECT quantity FROM stock WHERE id=1");
        if (!row.quantity) return false;
        await store.run(
          "UPDATE stock SET quantity=? WHERE id=1",
          row.quantity - 1,
        );
        return true;
      });
    assert.deepEqual(
      (await Promise.all([reserve(), reserve(), reserve()])).sort(),
      [false, true, true],
    );
    assert.equal((await store.one("SELECT quantity FROM stock")).quantity, 0);
    assert.ok(attempts > 3);
    assert.equal(
      (await store.one("SELECT count(*) AS n FROM write_guards")).n,
      0,
    );
  } finally {
    await store.close();
  }
});
test("a failed atomic batch rolls back every write and its revision", async () => {
  const store = await setup();
  try {
    const before = (await store.one("SELECT version FROM write_revision"))
      .version;
    await assert.rejects(
      store.transaction(async () => {
        await store.run("UPDATE stock SET quantity=1 WHERE id=1");
        await store.run("INSERT INTO stock VALUES(2,-1)");
      }),
    );
    assert.equal(
      (await store.one("SELECT quantity FROM stock WHERE id=1")).quantity,
      2,
    );
    assert.equal(
      (await store.one("SELECT version FROM write_revision")).version,
      before,
    );
  } finally {
    await store.close();
  }
});
