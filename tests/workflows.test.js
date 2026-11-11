import sharp from "sharp";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHmac } from "node:crypto";
process.env.NODE_ENV = "test";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "flames-test-"));
process.env.ADMIN_EMAIL = "admin@example.test";
process.env.STRIPE_WEBHOOK_SECRET = "test-webhook-secret";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.ASTROLOGY_PROVIDER_URL;
const workerURL = process.env.TEST_WORKER_URL;
const { server } = workerURL ? {} : await import("../src/server.js");
if (server) await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = workerURL || `http://127.0.0.1:${server.address().port}`;
process.env.APP_ORIGIN = base;
const proxy = workerURL
  ? await (
      await import("wrangler")
    ).getPlatformProxy({
      configPath: process.env.TEST_WORKER_CONFIG || "wrangler.test.jsonc",
      persist: { path: process.env.TEST_WORKER_STATE || ".wrangler/state/v3" },
    })
  : null;
const db = proxy
  ? proxy.env.DB
  : new DatabaseSync(join(process.env.DATA_DIR, "flames.sqlite"));
const seed = async (sql, ...args) =>
  proxy
    ? db
        .prepare(sql)
        .bind(...args)
        .run()
    : db.prepare(sql).run(...args);
async function request(path, method = "GET", data, cookie = "", headers = {}) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...headers },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
async function account(email) {
  assert.equal(
    (
      await request("/auth/signup", "POST", {
        email,
        name: email.split("@")[0],
        password: "a-strong-test-password",
      })
    ).status,
    201,
  );
  const login = await request("/auth/login", "POST", {
    email,
    password: "a-strong-test-password",
  });
  assert.equal(login.status, 200);
  return { cookie: login.cookie, user: login.data.user };
}
test("persistent customer, reader, admin, booking, order and payment workflows", async (t) => {
  try {
    const admin = await account("admin@example.test");
    await seed(
      "UPDATE users SET role='admin',verified=1 WHERE id=?",
      admin.user.id,
    );
    const customer = await account("customer@example.test"),
      other = await account("other@example.test"),
      reader = await account("reader@example.test");
    await t.test(
      "authentication, roles, CSRF and owner isolation",
      async () => {
        assert.equal(
          (await request("/admin", "GET", undefined, customer.cookie)).status,
          403,
        );
        assert.equal((await request("/records?kind=profile")).status, 401);
        assert.equal(
          (
            await request(
              "/me",
              "PATCH",
              { name: "Changed" },
              customer.cookie,
              { Origin: "https://other.test" },
            )
          ).status,
          403,
        );
        const r = await request(
          "/records",
          "POST",
          {
            kind: "address",
            data: {
              name: "Customer",
              line: "1 Main Street",
              city: "Pune",
              postal: "411001",
              country: "India",
            },
          },
          customer.cookie,
        );
        assert.equal(r.status, 201);
        assert.equal(
          (
            await request(
              "/records/" + r.data.id,
              "GET",
              undefined,
              other.cookie,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              "/records",
              "POST",
              { kind: "product", data: { name: "X", price: 100, stock: 1 } },
              customer.cookie,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              "/auth/request-code",
              "POST",
              { purpose: "verify" },
              customer.cookie,
            )
          ).status,
          503,
        );
      },
    );
    let bookingId, productId, orderId;
    await t.test("private uploads and reviewed reader onboarding", async () => {
      const png = (
        await sharp({
          create: { width: 2, height: 2, channels: 3, background: "#ffffff" },
        })
          .png()
          .toBuffer()
      ).toString("base64");
      const f = await request(
        "/uploads",
        "POST",
        { name: "credential.png", base64: png },
        reader.cookie,
      );
      assert.equal(f.status, 201);
      assert.equal(
        (await request("/uploads/" + f.data.id, "GET", undefined, other.cookie))
          .status,
        403,
      );
      const a = await request(
        "/records",
        "POST",
        {
          kind: "application",
          data: {
            name: "Reader",
            languages: "English",
            experience: "Documented experience",
            credentials: [f.data.id],
          },
        },
        reader.cookie,
      );
      assert.equal(a.status, 201);
      assert.equal(
        (
          await request(
            "/admin/review",
            "POST",
            {
              id: a.data.id,
              status: "approved",
              review: "Credentials reviewed",
            },
            admin.cookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            "/records",
            "POST",
            {
              kind: "reader-profile",
              data: {
                name: "Reader",
                languages: "English",
                services: "Tarot",
                bio: "Reflective practice",
                price: 10000,
              },
            },
            reader.cookie,
          )
        ).status,
        201,
      );
      assert.equal((await request("/readers")).data.length, 1);
    });
    await t.test(
      "slot overlap and duplicate reservation prevention",
      async () => {
        const starts = new Date(Date.now() + 3600000).toISOString(),
          ends = new Date(Date.now() + 5400000).toISOString();
        const slot = await request(
          "/slots",
          "POST",
          { starts, ends, price: 10000 },
          reader.cookie,
        );
        assert.equal(slot.status, 201);
        assert.equal(
          (
            await request(
              "/slots",
              "POST",
              { starts, ends, price: 10000 },
              reader.cookie,
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await request(
              "/bookings",
              "POST",
              {
                slot: slot.data.id,
                format: "chat",
                intake: "A reflective question",
              },
              customer.cookie,
              { "Idempotency-Key": "booking1" },
            )
          ).status,
          403,
        );
        await seed(
          "UPDATE users SET verified=1 WHERE id IN (?,?)",
          customer.user.id,
          other.user.id,
        );
        const b = await request(
          "/bookings",
          "POST",
          {
            slot: slot.data.id,
            format: "chat",
            intake: "A reflective question",
          },
          customer.cookie,
          { "Idempotency-Key": "booking1" },
        );
        assert.equal(b.status, 201);
        bookingId = b.data.id;
        const replay = await request(
          "/bookings",
          "POST",
          {
            slot: slot.data.id,
            format: "chat",
            intake: "A reflective question",
          },
          customer.cookie,
          { "Idempotency-Key": "booking1" },
        );
        assert.equal(replay.data.id, bookingId);
        assert.equal(
          (
            await request(
              "/bookings",
              "POST",
              {
                slot: slot.data.id,
                format: "chat",
                intake: "Another question",
              },
              other.cookie,
              { "Idempotency-Key": "booking2" },
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await request(
              "/bookings/" + bookingId,
              "GET",
              undefined,
              other.cookie,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              "/bookings/" + bookingId + "/checkout",
              "POST",
              {},
              customer.cookie,
            )
          ).status,
          503,
        );
      },
    );
    async function webhook(event) {
      const raw = JSON.stringify(event),
        stamp = Math.floor(Date.now() / 1000),
        signature = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET)
          .update(`${stamp}.${raw}`)
          .digest("hex");
      const r = await fetch(base + "/api/payments/webhook", {
        method: "POST",
        headers: { "stripe-signature": `t=${stamp},v1=${signature}` },
        body: raw,
      });
      return { status: r.status, data: await r.json() };
    }
    await t.test(
      "signed webhook confirms once; customer cannot fake confirmation",
      async () => {
        const event = {
          id: "evt_booking_test",
          type: "checkout.session.completed",
          data: {
            object: {
              client_reference_id: bookingId,
              payment_status: "paid",
              amount_total: 10000,
              currency: "inr",
              payment_intent: "pi_test_fixture",
            },
          },
        };
        assert.equal((await webhook(event)).status, 200);
        assert.equal((await webhook(event)).data.duplicate, true);
        assert.equal(
          (
            await request(
              "/bookings/" + bookingId,
              "GET",
              undefined,
              customer.cookie,
            )
          ).data.status,
          "confirmed",
        );
        assert.equal(
          (
            await request(
              "/bookings/" + bookingId + "/messages",
              "POST",
              { message: "Too early" },
              customer.cookie,
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              "/bookings/" + bookingId + "/end",
              "POST",
              {},
              customer.cookie,
            )
          ).status,
          400,
        );
        const invalid = await fetch(base + "/api/payments/webhook", {
          method: "POST",
          body: JSON.stringify(event),
        });
        assert.equal(invalid.status, 400);
      },
    );
    await t.test("real calculations and persisted readings", async () => {
      const r = await request("/calculate", "POST", {
        type: "numerology",
        name: "ABC",
        date: "1990-01-01",
      });
      assert.equal(r.status, 200);
      const saved = await request(
        "/records",
        "POST",
        { kind: "report", data: r.data },
        customer.cookie,
      );
      assert.equal(saved.status, 201);
      assert.equal(
        (
          await request(
            "/records?kind=report",
            "GET",
            undefined,
            customer.cookie,
          )
        ).data.length,
        1,
      );
      assert.equal(
        (
          await request(
            "/calculate",
            "POST",
            {
              type: "compatibility",
              first: { date: "2000-01-01", unknownTime: true, timezone: "UTC" },
              second: {
                date: "2000-01-02",
                unknownTime: true,
                timezone: "UTC",
              },
            },
            customer.cookie,
          )
        ).status,
        503,
      );
    });
    await t.test(
      "shared reports require consent, isolate owners, expire and revoke",
      async () => {
        const saved = (
          await request(
            "/records?kind=report",
            "GET",
            undefined,
            customer.cookie,
          )
        ).data[0];
        assert.equal(
          (
            await request(
              "/report-shares/" + saved.id,
              "POST",
              {},
              customer.cookie,
            )
          ).status,
          400,
        );
        const share = await request(
          "/report-shares/" + saved.id,
          "POST",
          { consent: true },
          customer.cookie,
        );
        assert.equal(share.status, 201);
        const token = new URL(share.data.url).searchParams.get("token");
        assert.equal(
          (await request("/shared-report?token=" + token)).data.data.type,
          "numerology",
        );
        assert.equal(
          (
            await request(
              "/report-shares/" + saved.id,
              "DELETE",
              undefined,
              other.cookie,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              "/report-shares/" + saved.id,
              "DELETE",
              undefined,
              customer.cookie,
            )
          ).status,
          200,
        );
        assert.equal(
          (await request("/shared-report?token=" + token)).status,
          404,
        );
        assert.equal((await request("/places?q=Pune")).status, 503);
      },
    );
    await t.test("support ticket and refund request ownership", async () => {
      const ticket = await request(
        "/records",
        "POST",
        {
          kind: "ticket",
          data: { subject: "Help", message: "Question about an appointment" },
        },
        customer.cookie,
      );
      assert.equal(ticket.status, 201);
      assert.equal(
        (
          await request(
            "/records/" + ticket.data.id,
            "PATCH",
            { reply: "We can help", close: true },
            admin.cookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            "/records/" + ticket.data.id,
            "GET",
            undefined,
            customer.cookie,
          )
        ).data.data.status,
        "closed",
      );
      const refund = await request(
        "/records",
        "POST",
        {
          kind: "refund",
          data: { booking: bookingId, reason: "Cannot attend" },
        },
        customer.cookie,
      );
      assert.equal(refund.status, 201);
      assert.equal(
        (
          await request(
            "/records",
            "POST",
            {
              kind: "refund",
              data: { booking: bookingId, reason: "Cannot attend" },
            },
            customer.cookie,
          )
        ).status,
        409,
      );
    });

    await t.test(
      "palmistry assignment, image privacy and report delivery",
      async () => {
        const base64 = (
          await sharp({
            create: { width: 2, height: 2, channels: 3, background: "#fff" },
          })
            .png()
            .toBuffer()
        ).toString("base64");
        const f = (
          await request(
            "/uploads",
            "POST",
            { name: "palm.png", base64 },
            customer.cookie,
          )
        ).data;
        const p = await request(
          "/records",
          "POST",
          {
            kind: "palmistry",
            data: {
              left: f.id,
              right: f.id,
              question: "Reflect on these lines",
            },
          },
          customer.cookie,
        );
        assert.equal(p.status, 201);
        assert.equal(
          (await request("/uploads/" + f.id, "GET", undefined, reader.cookie))
            .status,
          403,
        );
        assert.equal(
          (
            await request(
              "/admin/palmistry",
              "POST",
              { id: p.data.id, reader: reader.user.id },
              admin.cookie,
            )
          ).status,
          200,
        );
        const download = await fetch(base + "/api/uploads/" + f.id, {
          headers: { Cookie: reader.cookie },
        });
        assert.equal(download.status, 200);
        assert.equal(
          (
            await request(
              "/reader/palmistry",
              "POST",
              {
                id: p.data.id,
                report: "A reader-authored reflective interpretation.",
              },
              reader.cookie,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              "/records/" + p.data.id,
              "GET",
              undefined,
              customer.cookie,
            )
          ).data.data.status,
          "delivered",
        );
        assert.equal(
          (
            await request(
              "/records/" + p.data.id,
              "PATCH",
              { status: "delivered", report: "Unreviewed" },
              customer.cookie,
            )
          ).status,
          400,
        );
      },
    );
    await t.test(
      "scheduled session chat, shared files, private notes and completion",
      async () => {
        await seed(
          "UPDATE slots SET starts=?,ends=? WHERE id=(SELECT slot FROM bookings WHERE id=?)",
          new Date(Date.now() - 60000).toISOString(),
          new Date(Date.now() + 60000).toISOString(),
          bookingId,
        );
        assert.equal(
          (
            await request(
              "/bookings/" + bookingId + "/messages",
              "POST",
              { message: "A real persisted test message" },
              customer.cookie,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              "/bookings/" + bookingId + "/messages",
              "GET",
              undefined,
              reader.cookie,
            )
          ).data.length,
          1,
        );
        assert.equal(
          (
            await request(
              "/bookings/" + bookingId + "/room",
              "POST",
              {},
              customer.cookie,
            )
          ).status,
          503,
        );
        const base64 = (
          await sharp({
            create: { width: 2, height: 2, channels: 3, background: "#fff" },
          })
            .png()
            .toBuffer()
        ).toString("base64");
        const upload = await request(
          "/uploads",
          "POST",
          { name: "shared.png", base64 },
          customer.cookie,
        );
        assert.equal(
          (
            await request(
              "/bookings/" + bookingId + "/files",
              "POST",
              { upload: upload.data.id },
              customer.cookie,
            )
          ).status,
          201,
        );
        const sharedDownload = await fetch(
          base + "/api/uploads/" + upload.data.id,
          { headers: { Cookie: reader.cookie } },
        );
        assert.equal(sharedDownload.status, 200);
        assert.equal(
          (
            await request(
              "/uploads/" + upload.data.id,
              "GET",
              undefined,
              other.cookie,
            )
          ).status,
          403,
        );
        const note = await request(
          "/records",
          "POST",
          {
            kind: "note",
            data: { booking: bookingId, text: "Private reader note" },
          },
          reader.cookie,
        );
        assert.equal(note.status, 201);
        assert.equal(
          (
            await request(
              "/records/" + note.data.id,
              "GET",
              undefined,
              customer.cookie,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              "/bookings/" + bookingId + "/end",
              "POST",
              {},
              reader.cookie,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              "/records",
              "POST",
              {
                kind: "feedback",
                data: {
                  booking: bookingId,
                  rating: 5,
                  comment: "Test feedback",
                },
              },
              customer.cookie,
            )
          ).status,
          201,
        );
      },
    );
    await t.test(
      "shop inventory, authoritative prices, idempotency and restock",
      async () => {
        const p = await request(
          "/records",
          "POST",
          {
            kind: "product",
            data: {
              name: "Test fixture product",
              description: "Automated test only",
              price: 1500,
              stock: 2,
            },
          },
          admin.cookie,
        );
        assert.equal(p.status, 201);
        productId = p.data.id;
        const addr = (
          await request(
            "/records?kind=address",
            "GET",
            undefined,
            customer.cookie,
          )
        ).data[0];
        const data = {
          address: addr.id,
          items: [{ id: productId, quantity: 2, price: 1 }],
        };
        const o = await request("/orders", "POST", data, customer.cookie, {
          "Idempotency-Key": "order1",
        });
        assert.equal(o.status, 201);
        orderId = o.data.id;
        assert.equal(o.data.total, 3000);
        assert.equal(
          (
            await request("/orders", "POST", data, customer.cookie, {
              "Idempotency-Key": "order1",
            })
          ).data.id,
          orderId,
        );
        assert.equal(
          (
            await request("/orders", "POST", data, customer.cookie, {
              "Idempotency-Key": "order2",
            })
          ).status,
          409,
        );
        assert.equal(
          (await request("/orders/" + orderId, "GET", undefined, other.cookie))
            .status,
          403,
        );
        assert.equal(
          (
            await request(
              "/orders/" + orderId + "/cancel",
              "POST",
              {},
              customer.cookie,
            )
          ).status,
          200,
        );
        assert.equal((await request("/catalog")).data.product[0].data.stock, 2);
        assert.equal(
          (
            await request(
              "/orders/" + orderId + "/cancel",
              "POST",
              {},
              customer.cookie,
            )
          ).status,
          400,
        );
      },
    );
  } finally {
    if (server) await new Promise((r) => server.close(r));
    if (proxy) await proxy.dispose();
    else db.close();
    rmSync(process.env.DATA_DIR, { recursive: true, force: true });
  }
});
