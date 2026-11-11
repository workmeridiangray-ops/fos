import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

// D1 exposes atomic batches, not interactive SQL transactions. Buffer writes and
// guard the read snapshot with a revision check inside the same atomic batch.
// Every application write advances the revision, including writes outside a transaction.
export function createSQLStore(driver) {
  const context = new AsyncLocalStorage();
  const revision = [
    "UPDATE write_revision SET version=version+1 WHERE id=1",
    [],
  ];
  const argsFor = (args) =>
    args.map((value) => (value === undefined ? null : value));
  return {
    one: (sql, ...args) => driver.one(sql, ...argsFor(args)),
    all: (sql, ...args) => driver.all(sql, ...argsFor(args)),
    async run(sql, ...args) {
      const pending = context.getStore();
      if (pending) {
        pending.push([sql, argsFor(args)]);
        // Queued writes must not branch on changes or read their uncommitted writes.
        return {};
      }
      const results = await driver.batch([
        [sql, argsFor(args)],
        [
          "UPDATE write_revision SET version=version+1 WHERE id=1 AND changes()>0",
          [],
        ],
      ]);
      return results[0];
    },
    async transaction(callback) {
      if (context.getStore())
        throw Error("Nested transactions are unsupported.");
      for (let attempt = 0; attempt < 5; attempt++) {
        const snapshot = await driver.one(
          "SELECT version FROM write_revision WHERE id=1",
        );
        const pending = [];
        const value = await context.run(pending, callback);
        if (!pending.length) return value;
        const guard = randomUUID();
        try {
          await driver.batch([
            [
              "INSERT INTO write_guards(id,expected,actual) SELECT ?,?,version FROM write_revision WHERE id=1",
              [guard, snapshot.version],
            ],
            ...pending,
            revision,
            ["DELETE FROM write_guards WHERE id=?", [guard]],
          ]);
          return value;
        } catch (error) {
          if (!String(error.message).includes("snapshot_changed")) throw error;
        }
      }
      throw Object.assign(
        new Error("Your data changed during this request. Please retry."),
        { status: 409 },
      );
    },
  };
}
