import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  randomInt,
} from "node:crypto";
import { kundli, numerology, tarot, birthInstant } from "./calculations.js";
export function createApplication(runtime) {
  const {
    env,
    one,
    all,
    run,
    transaction,
    coordinateTimezones,
    putUpload,
    readUpload,
    transformImage,
    serveStatic,
    rate,
  } = runtime;
  const {
    sendEmail,
    stripe,
    verifyWebhook,
    astrology,
    mediaRoom,
    searchPlaces,
  } = runtime.integrations;
  const now = () => new Date().toISOString(),
    id = () => randomUUID(),
    hash = (x) => createHash("sha256").update(x).digest("hex");
  const parse = (r) =>
    r
      ? {
          ...r,
          data: JSON.parse(r.data),
        }
      : r;
  function fail(message, status = 400) {
    throw Object.assign(new Error(message), {
      status,
    });
  }
  function text(value, label, max = 1000) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      fail(`${label} is required (up to ${max} characters).`);
    return value.trim();
  }
  function password(value) {
    if (typeof value !== "string" || value.length < 12 || value.length > 200)
      fail("Use a password between 12 and 200 characters.");
    const salt = randomBytes(16).toString("hex");
    return `${salt}:${scryptSync(value, salt, 64).toString("hex")}`;
  }
  function checkPassword(value, stored) {
    const [salt, digest] = stored.split(":");
    const actual = scryptSync(value, salt, 64);
    return timingSafeEqual(Buffer.from(digest, "hex"), actual);
  }
  const safeUser = (u) =>
    u
      ? {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          verified: !!u.verified,
        }
      : null;
  async function audit(actor, action, target) {
    await run(
      "INSERT INTO audit VALUES(?,?,?,?,?)",
      id(),
      actor || null,
      action,
      target,
      now(),
    );
  }
  async function save(kind, owner, data, recordId = id()) {
    const stamp = now();
    const previous = await one("SELECT * FROM records WHERE id=?", recordId);
    await run(
      "INSERT INTO records VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated",
      recordId,
      kind,
      owner,
      JSON.stringify(data),
      stamp,
      stamp,
    );
    return {
      ...(previous || {
        id: recordId,
        kind,
        owner,
        created: stamp,
      }),
      data,
      updated: stamp,
    };
  }
  const recordKinds = [
    "profile",
    "report",
    "favourite",
    "address",
    "ticket",
    "application",
    "reader-profile",
    "note",
    "payout-details",
    "feedback",
    "palmistry",
    "refund",
    "notification",
    "product",
    "article",
    "service",
    "settings",
    "payout",
  ];
  const publicKinds = ["product", "article", "service"];
  async function ownRecord(recordId, u) {
    const r = parse(await one("SELECT * FROM records WHERE id=?", recordId));
    if (!r) fail("Record not found.", 404);
    if (r.owner !== u.id && u.role !== "admin") fail("Permission denied.", 403);
    return r;
  }
  async function participant(bookingId, u) {
    const b = await one(
      "SELECT b.*,s.starts,s.ends FROM bookings b JOIN slots s ON s.id=b.slot WHERE b.id=?",
      bookingId,
    );
    if (!b) fail("Booking not found.", 404);
    if (![b.customer, b.reader].includes(u.id) && u.role !== "admin")
      fail("Permission denied.", 403);
    return b;
  }
  async function issueCode(u, purpose) {
    const code = String(randomInt(100000, 1000000)),
      codeId = id();
    await run("DELETE FROM codes WHERE user_id=? AND purpose=?", u.id, purpose);
    await run(
      "INSERT INTO codes(id,user_id,purpose,hash,expires) VALUES(?,?,?,?,?)",
      codeId,
      u.id,
      purpose,
      hash(code),
      Date.now() + 600000,
    );
    await sendEmail(
      u.email,
      purpose === "reset"
        ? "Reset your Flames of Shiva password"
        : "Verify your Flames of Shiva account",
      `Your ${purpose} code is ${code}. It expires in 10 minutes.`,
    );
    return {
      codeId,
      message: "A code was sent to your email.",
    };
  }
  async function verifyCode(codeId, code, purpose) {
    const r = await one("SELECT * FROM codes WHERE id=?", codeId);
    if (
      !r ||
      r.purpose !== purpose ||
      r.expires < Date.now() ||
      r.attempts >= 5
    )
      fail("Code expired or unavailable. Request a new one.");
    await run("UPDATE codes SET attempts=attempts+1 WHERE id=?", codeId);
    if (r.hash !== hash(String(code))) fail("The code is incorrect.");
    await run("DELETE FROM codes WHERE id=?", codeId);
    return r.user_id;
  }
  async function body(req) {
    let data = "";
    for await (const chunk of req) {
      data += chunk;
      if (Buffer.byteLength(data) > 8000000)
        fail("Upload exceeds the request limit.", 413);
    }
    try {
      return data ? JSON.parse(data) : {};
    } catch {
      fail("Invalid JSON.");
    }
  }
  async function validateRecord(kind, d, u) {
    if (!recordKinds.includes(kind)) fail("Unknown record type.");
    if (!d || typeof d !== "object" || Array.isArray(d))
      fail("Invalid record.");
    if (
      publicKinds.includes(kind) ||
      ["settings", "notification"].includes(kind)
    ) {
      if (u.role !== "admin") fail("Administrator permission required.", 403);
    }
    if (kind === "product") {
      text(d.name, "Product name", 150);
      text(d.description, "Description", 5000);
      if (
        !Number.isInteger(Number(d.price)) ||
        Number(d.price) < 1 ||
        !Number.isInteger(Number(d.stock)) ||
        Number(d.stock) < 0
      )
        fail("Price in paise and stock quantity must be valid integers.");
      d.price = Number(d.price);
      d.stock = Number(d.stock);
    }
    if (kind === "article") {
      text(d.title, "Article title", 200);
      text(d.body, "Article body", 30000);
    }
    if (kind === "address") {
      text(d.name, "Recipient", 120);
      text(d.line, "Street address", 500);
      text(d.city, "City", 120);
      text(d.postal, "Postal code", 30);
      text(d.country, "Country", 120);
    }
    if (kind === "payout") {
      if (u.role !== "admin")
        fail("Use the administration payout workflow.", 403);
    }
    if (kind === "profile") {
      text(d.name, "Name", 120);
      birthInstant(d);
      if (
        !Number.isFinite(Number(d.latitude)) ||
        Math.abs(Number(d.latitude)) > 90 ||
        !Number.isFinite(Number(d.longitude)) ||
        Math.abs(Number(d.longitude)) > 180
      )
        fail("Valid birth coordinates are required.");
    }
    if (kind === "ticket") {
      text(d.subject, "Subject", 200);
      text(d.message, "Message", 5000);
      return {
        subject: d.subject,
        message: d.message,
        status: "open",
        replies: [],
      };
    }
    if (kind === "application") {
      text(d.name, "Name", 120);
      text(d.experience, "Experience", 5000);
      text(d.languages, "Languages", 300);
      if (!Array.isArray(d.credentials) || !d.credentials.length)
        fail("Upload at least one credential.");
      for (const x of d.credentials)
        if (
          !(await one("SELECT id FROM uploads WHERE id=? AND owner=?", x, u.id))
        )
          fail("Credential not accessible.");
      return {
        ...d,
        status: "submitted",
      };
    }
    if (kind === "reader-profile") {
      if (!["reader", "admin"].includes(u.role))
        fail("Approved reader account required.", 403);
      text(d.name, "Name", 120);
      text(d.bio, "Biography", 3000);
      text(d.languages, "Languages", 300);
      if (!Number.isInteger(Number(d.price)) || Number(d.price) < 0)
        fail("Enter a valid rate in paise.");
    }
    if (kind === "report") {
      if (!["numerology", "tarot", "kundli", "compatibility"].includes(d.type))
        fail("Unknown report.");
    }
    if (kind === "note") {
      if (u.role !== "reader") fail("Reader permission required.", 403);
      const b = await participant(d.booking, u);
      if (b.reader !== u.id) fail("Assigned reader required.", 403);
      text(d.text, "Notes", 10000);
    }
    if (kind === "palmistry") {
      if (
        !(
          await Promise.all(
            ["left", "right"].map(
              async (k) =>
                await one(
                  `SELECT id FROM uploads WHERE id=? AND owner=? AND mime IN ('image/png','image/jpeg')`,
                  d[k] || "",
                  u.id,
                ),
            ),
          )
        ).every(Boolean)
      )
        fail("Upload both palm images.");
      return {
        ...d,
        status: "awaiting-reader",
      };
    }
    if (kind === "refund") {
      const b = await participant(d.booking, u);
      if (b.customer !== u.id || b.status !== "confirmed")
        fail("A confirmed paid booking is required.");
      text(d.reason, "Reason", 2000);
      if (
        (
          await all(
            "SELECT * FROM records WHERE kind='refund' AND owner=?",
            u.id,
          )
        )
          .map(parse)
          .some((r) => r.data.booking === b.id)
      )
        fail("A refund request already exists.", 409);
      return {
        ...d,
        status: "requested",
        amount: b.amount,
      };
    }
    if (kind === "feedback") {
      const b = await participant(d.booking, u);
      if (b.customer !== u.id || b.status !== "completed")
        fail("Complete the session before leaving feedback.");
      if (
        !Number.isInteger(Number(d.rating)) ||
        Number(d.rating) < 1 ||
        Number(d.rating) > 5
      )
        fail("Choose a rating from 1 to 5.");
    }
    if (kind === "payout-details") {
      if (!["reader", "admin"].includes(u.role))
        fail("Reader permission required.", 403);
      text(d.reference, "Payout account reference", 200);
      return {
        reference: d.reference,
        status: "requires-provider-verification",
      };
    }
    return d;
  }
  return async function handle(req, res) {
    const origin = env.APP_ORIGIN || `http://localhost:${env.PORT || 3000}`;
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader(
      "X-Frame-Options",
      env.NODE_ENV === "production" ? "DENY" : "SAMEORIGIN",
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'self'; base-uri 'self'",
    );
    const reply = (value, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(value));
      return true;
    };
    try {
      const url = new URL(req.url, origin),
        path = url.pathname,
        method = req.method;
      if (!path.startsWith("/api/")) {
        if (method !== "GET") fail("Method not allowed.", 405);
        return serveStatic(req, res);
      }
      if (
        ["POST", "PUT", "DELETE", "PATCH"].includes(method) &&
        path !== "/api/payments/webhook" &&
        req.headers.origin &&
        req.headers.origin !== origin
      )
        fail("Cross-origin request rejected.", 403);
      await rate(req.socket.remoteAddress + ":api", 300);
      const cutoff = new Date(Date.now() - 1800000).toISOString();
      await run(
        "UPDATE bookings SET status='cancelled' WHERE status='pending' AND checkout_id IS NULL AND created<?",
        cutoff,
      );
      for (const o of await all(
        "SELECT * FROM orders WHERE status='pending' AND checkout_id IS NULL AND created<?",
        cutoff,
      )) {
        const transactionResult0 = await transaction(async () => {
          const current = await one("SELECT * FROM orders WHERE id=?", o.id);
          if (current.status !== "pending" || current.checkout_id) return;
          await run("UPDATE orders SET status='cancelled' WHERE id=?", o.id);
          for (const line of JSON.parse(o.lines)) {
            const r = parse(
              await one("SELECT * FROM records WHERE id=?", line.id),
            );
            if (r)
              await save(
                "product",
                r.owner,
                {
                  ...r.data,
                  stock: r.data.stock + line.quantity,
                },
                r.id,
              );
          }
        });
        if (transactionResult0 === true) return;
      }
      const token = (req.headers.cookie || "")
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("session="))
        ?.slice(8);
      const u = token
        ? await one(
            "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
            hash(token),
            Date.now(),
          )
        : null;
      const requireUser = () => {
        if (!u) fail("Sign in to continue.", 401);
        return u;
      };
      const admin = () => {
        requireUser();
        if (u.role !== "admin") fail("Administrator permission required.", 403);
      };
      if (path === "/api/places" && method === "GET") {
        const query = text(url.searchParams.get("q"), "Place name", 200);
        const rows = await searchPlaces(query);
        return reply(
          rows.map((r) => ({
            ...r,
            timezone: coordinateTimezones(r.latitude, r.longitude)[0],
          })),
        );
      }
      if (path === "/api/shared-report" && method === "GET") {
        const tokenValue = text(
          url.searchParams.get("token"),
          "Share token",
          100,
        );
        const share = await one(
          "SELECT * FROM report_shares WHERE token=? AND revoked=0 AND expires>?",
          hash(tokenValue),
          Date.now(),
        );
        if (!share)
          fail("This shared reading has expired or been revoked.", 404);
        const r = parse(
          await one(
            "SELECT * FROM records WHERE id=? AND kind='report'",
            share.report,
          ),
        );
        if (!r) fail("Reading not found.", 404);
        return reply({
          data: r.data,
          expires: share.expires,
        });
      }
      if (path.startsWith("/api/report-shares/")) {
        requireUser();
        const reportId = path.split("/")[3],
          r = await ownRecord(reportId, u);
        if (r.kind !== "report") fail("Select a saved reading.");
        if (method === "GET")
          return reply(
            await all(
              "SELECT id,expires,revoked,created FROM report_shares WHERE report=? AND owner=?",
              reportId,
              u.id,
            ),
          );
        if (method === "POST") {
          const d = await body(req);
          if (d.consent !== true)
            fail(
              "Confirm that anyone with the link can read this report, including personal details.",
            );
          const tokenValue = randomBytes(32).toString("hex"),
            shareId = id(),
            expires = Date.now() + 604800000;
          await run(
            "INSERT INTO report_shares VALUES(?,?,?,?,?,?,?)",
            shareId,
            reportId,
            u.id,
            hash(tokenValue),
            expires,
            0,
            now(),
          );
          await audit(u.id, "report.share", reportId);
          return reply(
            {
              id: shareId,
              url: origin + "/shared-reading?token=" + tokenValue,
              expires,
            },
            201,
          );
        }
        if (method === "DELETE") {
          await run(
            "UPDATE report_shares SET revoked=1 WHERE report=? AND owner=?",
            reportId,
            u.id,
          );
          await audit(u.id, "report.revoke", reportId);
          return reply({
            ok: true,
          });
        }
      }
      if (path === "/api/status")
        return reply({
          email: !!(env.RESEND_API_KEY && env.EMAIL_FROM),
          payments: !!env.STRIPE_SECRET_KEY,
          vedic: !!env.ASTROLOGY_PROVIDER_URL,
          voiceVideo: !!env.DAILY_API_KEY,
          storage: runtime.storageDescription || "Private local disk",
          development: env.NODE_ENV !== "production",
        });
      if (path === "/api/me" && method === "GET")
        return reply({
          user: safeUser(u),
        });
      if (path === "/api/auth/signup" && method === "POST") {
        await rate(req.socket.remoteAddress + ":auth", 15);
        const d = await body(req),
          email = text(d.email, "Email", 254).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          fail("Enter a valid email.");
        const name = text(d.name, "Name", 120),
          pw = password(d.password);
        if (await one("SELECT id FROM users WHERE email=?", email))
          fail(
            "An account already exists. Sign in or recover your password.",
            409,
          );
        const userId = id();
        await run(
          "INSERT INTO users VALUES(?,?,?,?,?,?,?)",
          userId,
          email,
          name,
          pw,
          "customer",
          0,
          now(),
        );
        return reply(
          {
            created: true,
            message:
              "Your account is ready. Sign in to request email verification.",
          },
          201,
        );
      }
      if (path === "/api/auth/login" && method === "POST") {
        await rate(req.socket.remoteAddress + ":auth", 15);
        const d = await body(req),
          user = await one(
            "SELECT * FROM users WHERE email=?",
            String(d.email).toLowerCase(),
          );
        if (
          !user ||
          typeof d.password !== "string" ||
          d.password.length > 200 ||
          !checkPassword(d.password, user.password)
        )
          fail("Email or password is incorrect.", 401);
        const t = randomBytes(32).toString("hex");
        await run(
          "INSERT INTO sessions VALUES(?,?,?)",
          hash(t),
          user.id,
          Date.now() + 86400000 * 7,
        );
        res.setHeader(
          "Set-Cookie",
          `session=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${env.NODE_ENV === "production" ? "; Secure" : ""}`,
        );
        return reply({
          user: safeUser(user),
        });
      }
      if (path === "/api/auth/logout" && method === "POST") {
        if (token) await run("DELETE FROM sessions WHERE token=?", hash(token));
        res.setHeader(
          "Set-Cookie",
          "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        );
        return reply({
          ok: true,
        });
      }
      if (path === "/api/auth/request-code" && method === "POST") {
        await rate(req.socket.remoteAddress + ":codes", 5);
        const d = await body(req);
        if (d.purpose === "reset") {
          const target = await one(
            "SELECT * FROM users WHERE email=?",
            String(d.email).toLowerCase(),
          );
          if (!target)
            return reply({
              message: "If this account exists, a reset code will be sent.",
            });
          return reply(await issueCode(target, "reset"));
        }
        requireUser();
        return reply(await issueCode(u, "verify"));
      }
      if (path === "/api/auth/verify" && method === "POST") {
        requireUser();
        const d = await body(req),
          r = await one("SELECT user_id FROM codes WHERE id=?", d.codeId);
        if (r?.user_id !== u.id) fail("Code not accessible.", 403);
        await verifyCode(d.codeId, d.code, "verify");
        await run(
          "UPDATE users SET verified=1,role=CASE WHEN email=? THEN 'admin' ELSE role END WHERE id=?",
          env.ADMIN_EMAIL || "",
          u.id,
        );
        return reply({
          verified: true,
        });
      }
      if (path === "/api/auth/reset" && method === "POST") {
        const d = await body(req),
          pw = password(d.password),
          uid = await verifyCode(d.codeId, d.code, "reset");
        await run("UPDATE users SET password=? WHERE id=?", pw, uid);
        await run("DELETE FROM sessions WHERE user_id=?", uid);
        return reply({
          ok: true,
        });
      }
      if (path === "/api/me" && method === "PATCH") {
        requireUser();
        const d = await body(req);
        await run(
          "UPDATE users SET name=? WHERE id=?",
          text(d.name, "Name", 120),
          u.id,
        );
        return reply({
          user: safeUser(await one("SELECT * FROM users WHERE id=?", u.id)),
        });
      }
      if (path === "/api/readers") {
        const readers = (
          await all(
            "SELECT r.*,u.verified FROM records r JOIN users u ON u.id=r.owner WHERE r.kind='reader-profile' AND u.role='reader'",
          )
        )
          .map(parse)
          .map((r) => ({
            id: r.owner,
            ...r.data,
          }));
        return reply(readers);
      }
      if (path === "/api/catalog") {
        return reply(
          Object.fromEntries(
            await Promise.all(
              publicKinds.map(async (k) => [
                k,
                (
                  await all(
                    "SELECT * FROM records WHERE kind=? ORDER BY created DESC",
                    k,
                  )
                ).map(parse),
              ]),
            ),
          ),
        );
      }
      if (path === "/api/records" && method === "GET") {
        requireUser();
        const kind = url.searchParams.get("kind");
        if (!recordKinds.includes(kind)) fail("Unknown record type.");
        return reply(
          (
            await all(
              "SELECT * FROM records WHERE owner=? AND kind=? ORDER BY created DESC",
              u.id,
              kind,
            )
          ).map(parse),
        );
      }
      if (path === "/api/records" && method === "POST") {
        requireUser();
        const d = await body(req),
          data = await validateRecord(d.kind, d.data, u);
        const saved = await save(d.kind, u.id, data);
        await audit(u.id, "record.create", saved.id);
        return reply(saved, 201);
      }
      if (path.startsWith("/api/records/")) {
        requireUser();
        const r = await ownRecord(path.split("/")[3], u);
        if (method === "GET") return reply(r);
        if (method === "DELETE") {
          if (["refund", "application", "payout"].includes(r.kind))
            fail("This record must be retained for review.");
          await run("DELETE FROM records WHERE id=?", r.id);
          await audit(u.id, "record.delete", r.id);
          return reply({
            ok: true,
          });
        }
        if (method === "PATCH") {
          const d = await body(req);
          if (r.kind === "ticket") {
            const message = text(d.reply, "Reply", 5000);
            return reply(
              await save(
                "ticket",
                r.owner,
                {
                  ...r.data,
                  status: d.close ? "closed" : r.data.status,
                  replies: [
                    ...r.data.replies,
                    {
                      author: u.name,
                      body: message,
                      created: now(),
                    },
                  ],
                },
                r.id,
              ),
            );
          }
          if (
            ["refund", "application", "report", "palmistry", "payout"].includes(
              r.kind,
            )
          )
            fail("Use the dedicated review or calculation workflow.");
          const updated = await save(
            r.kind,
            r.owner,
            await validateRecord(r.kind, d, u),
            r.id,
          );
          await audit(u.id, "record.update", r.id);
          return reply(updated);
        }
      }
      if (path === "/api/calculate" && method === "POST") {
        const d = await body(req);
        let result;
        if (d.type === "numerology") result = numerology(d);
        else if (d.type === "tarot") result = tarot(d);
        else if (d.type === "kundli") {
          requireUser();
          result = d.vedic ? await astrology("kundli", d) : kundli(d);
        } else if (d.type === "compatibility") {
          requireUser();
          birthInstant(d.first);
          birthInstant(d.second);
          result = await astrology("compatibility", d);
        } else fail("Unknown calculation.");
        return reply(result);
      }
      if (path === "/api/horoscope" && method === "POST") {
        const d = await body(req);
        return reply(await astrology("horoscope", d));
      }
      if (path === "/api/uploads" && method === "POST") {
        requireUser();
        const d = await body(req);
        let bytes = Buffer.from(d.base64 || "", "base64");
        if (bytes.length < 10 || bytes.length > 5000000)
          fail("Upload an image or PDF up to 5 MB.");
        let mime;
        if (
          bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        )
          mime = "image/png";
        else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
          mime = "image/jpeg";
        else if (bytes.subarray(0, 5).toString() === "%PDF-")
          mime = "application/pdf";
        else fail("Only PNG, JPEG and PDF files are supported.");
        if (mime.startsWith("image/")) {
          try {
            bytes = await transformImage(bytes, mime);
          } catch {
            fail(
              runtime.imageError ||
                "This image is damaged or cannot be safely decoded.",
            );
          }
        } else {
          const source = bytes.toString("latin1");
          if (
            !source.includes("%%EOF") ||
            /\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction)\b/.test(source)
          )
            fail(
              "Upload a valid PDF without scripts, attachments or automatic actions.",
            );
        }
        const uid = id();
        await putUpload(uid, bytes);
        await run(
          "INSERT INTO uploads VALUES(?,?,?,?,?,?)",
          uid,
          u.id,
          mime,
          text(d.name, "File name", 200),
          bytes.length,
          now(),
        );
        return reply(
          {
            id: uid,
            mime,
            size: bytes.length,
          },
          201,
        );
      }
      if (path.startsWith("/api/uploads/") && method === "GET") {
        requireUser();
        const f = await one(
          "SELECT * FROM uploads WHERE id=?",
          path.split("/")[3],
        );
        if (!f) fail("File not found.", 404);
        if (f.owner !== u.id && u.role !== "admin") {
          const palmAccess = (
            await all("SELECT * FROM records WHERE kind='palmistry'")
          )
            .map(parse)
            .some(
              (r) =>
                r.data.reader === u.id &&
                [r.data.left, r.data.right].includes(f.id),
            );
          const sharedAccess = (
            await Promise.all(
              (await all("SELECT * FROM records WHERE kind='shared-file'"))
                .map(parse)
                .map(
                  async (r) =>
                    r.data.upload === f.id &&
                    (await one(
                      "SELECT id FROM bookings WHERE id=? AND (customer=? OR reader=?)",
                      r.data.booking,
                      u.id,
                      u.id,
                    )),
                ),
            )
          ).some(Boolean);
          const authorised = palmAccess || sharedAccess;
          if (!authorised) fail("Private upload.", 403);
        }
        res.writeHead(200, {
          "Content-Type": f.mime,
          "Content-Disposition": `attachment; filename="${f.id}${f.mime === "application/pdf" ? ".pdf" : f.mime === "image/png" ? ".png" : ".jpg"}"`,
        });
        return res.end(await readUpload(f.id));
      }
      if (path === "/api/slots" && method === "GET") {
        const reader = url.searchParams.get("reader");
        return reply(
          await all(
            "SELECT s.* FROM slots s WHERE s.reader=? AND s.starts>? AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.slot=s.id AND b.status IN ('pending','confirmed','active')) ORDER BY s.starts",
            reader || "",
            now(),
          ),
        );
      }
      if (path === "/api/slots" && method === "POST") {
        requireUser();
        if (u.role !== "reader") fail("Approved reader required.", 403);
        const d = await body(req),
          start = new Date(d.starts),
          end = new Date(d.ends),
          price = Number(d.price);
        if (
          !Number.isFinite(start.getTime()) ||
          !Number.isFinite(end.getTime()) ||
          start <= new Date() ||
          end <= start ||
          end - start > 7200000 ||
          !Number.isInteger(price) ||
          price < 0
        )
          fail(
            "Choose a future slot up to two hours and a nonnegative price in paise.",
          );
        if (
          await one(
            "SELECT id FROM slots WHERE reader=? AND starts<? AND ends>?",
            u.id,
            end.toISOString(),
            start.toISOString(),
          )
        )
          fail("This slot overlaps an existing slot.", 409);
        const sid = id();
        await run(
          "INSERT INTO slots VALUES(?,?,?,?,?)",
          sid,
          u.id,
          start.toISOString(),
          end.toISOString(),
          price,
        );
        return reply(
          {
            id: sid,
          },
          201,
        );
      }
      if (path.startsWith("/api/slots/") && method === "DELETE") {
        requireUser();
        const sid = path.split("/")[3],
          slot = await one("SELECT * FROM slots WHERE id=?", sid);
        if (!slot || slot.reader !== u.id) fail("Slot not accessible.", 403);
        if (await one("SELECT id FROM bookings WHERE slot=?", sid))
          fail("A slot linked to a booking must be retained.");
        await run("DELETE FROM slots WHERE id=?", sid);
        await audit(u.id, "availability.remove", sid);
        return reply({
          ok: true,
        });
      }
      if (path === "/api/bookings" && method === "GET") {
        requireUser();
        return reply(
          await all(
            "SELECT b.*,s.starts,s.ends,u.name reader_name FROM bookings b JOIN slots s ON s.id=b.slot JOIN users u ON u.id=b.reader WHERE b.customer=? OR b.reader=? ORDER BY s.starts DESC",
            u.id,
            u.id,
          ),
        );
      }
      if (path === "/api/bookings" && method === "POST") {
        requireUser();
        if (!u.verified) fail("Verify your email before booking.", 403);
        const d = await body(req),
          key = text(req.headers["idempotency-key"], "Idempotency key", 100),
          existing = await one(
            "SELECT * FROM bookings WHERE idempotency=?",
            u.id + ":" + key,
          );
        if (existing) return reply(existing);
        const slot = await one(
          "SELECT s.* FROM slots s JOIN users u ON u.id=s.reader WHERE s.id=? AND u.role='reader'",
          d.slot,
        );
        if (!slot || slot.starts <= now())
          fail("This slot is no longer available.", 409);
        if (!["chat", "voice", "video"].includes(d.format))
          fail("Choose a session format.");
        if (d.format !== "chat" && !env.DAILY_API_KEY)
          fail(
            "Voice and video require a configured communication provider.",
            503,
          );
        const intake = text(d.intake, "Consultation focus", 3000),
          bid = id();
        try {
          await run(
            "INSERT INTO bookings(id,customer,reader,slot,status,format,intake,amount,idempotency,created) VALUES(?,?,?,?,?,?,?,?,?,?)",
            bid,
            u.id,
            slot.reader,
            slot.id,
            "pending",
            d.format,
            intake,
            slot.price,
            u.id + ":" + key,
            now(),
          );
        } catch {
          fail("This slot has already been reserved.", 409);
        }
        await audit(u.id, "booking.reserve", bid);
        return reply(await one("SELECT * FROM bookings WHERE id=?", bid), 201);
      }
      if (path.startsWith("/api/bookings/")) {
        requireUser();
        const [, , , bid, action] = path.split("/");
        const b = await participant(bid, u);
        if (!action && method === "GET") return reply(b);
        if (action === "room" && method === "POST") {
          if (
            !["confirmed", "active"].includes(b.status) ||
            now() < b.starts ||
            now() > b.ends
          )
            fail("The private call opens only during a confirmed appointment.");
          return reply(await mediaRoom(b, u));
        }
        if (action === "checkout" && method === "POST") {
          if (b.customer !== u.id) fail("Only the customer may pay.", 403);
          if (b.status !== "pending")
            fail("This booking is not awaiting payment.", 409);
          const result = await stripe(
            "checkout/sessions",
            {
              mode: "payment",
              success_url: `${origin}/booking-confirmation?id=${bid}`,
              cancel_url: `${origin}/payment-failed?id=${bid}`,
              client_reference_id: bid,
              expires_at: String(Math.floor(Date.now() / 1000) + 1801),
              "metadata[booking]": bid,
              "line_items[0][price_data][currency]": b.currency,
              "line_items[0][price_data][unit_amount]": String(b.amount),
              "line_items[0][price_data][product_data][name]":
                "Flames of Shiva consultation",
              "line_items[0][quantity]": "1",
            },
            "checkout:" + bid,
          );
          await run(
            "UPDATE bookings SET checkout_url=?,checkout_id=? WHERE id=?",
            result.url,
            result.id,
            bid,
          );
          return reply({
            url: result.url,
          });
        }
        if (action === "cancel" && method === "POST") {
          if (b.status !== "pending")
            fail(
              "Paid bookings need a refund review; request a refund instead.",
            );
          if (b.checkout_id)
            await stripe(
              "checkout/sessions/" + b.checkout_id + "/expire",
              {},
              "cancel:" + bid,
            );
          await run("UPDATE bookings SET status='cancelled' WHERE id=?", bid);
          await audit(u.id, "booking.cancel", bid);
          return reply({
            ok: true,
          });
        }
        if (action === "reschedule" && method === "POST") {
          if (!["confirmed", "pending"].includes(b.status))
            fail("This booking cannot be rescheduled.");
          const d = await body(req),
            s = await one(
              "SELECT * FROM slots WHERE id=? AND reader=?",
              d.slot,
              b.reader,
            );
          if (!s || s.starts <= now() || s.price !== b.amount)
            fail("Select a future slot with the same reader and price.");
          try {
            await run("UPDATE bookings SET slot=? WHERE id=?", s.id, bid);
          } catch {
            fail("The new slot is already reserved.", 409);
          }
          await audit(u.id, "booking.reschedule", bid);
          return reply({
            ok: true,
          });
        }
        if (action === "files" && method === "GET")
          return reply(
            (await all("SELECT * FROM records WHERE kind='shared-file'"))
              .map(parse)
              .filter((r) => r.data.booking === bid),
          );
        if (action === "files" && method === "POST") {
          if (
            !["confirmed", "active"].includes(b.status) ||
            now() < b.starts ||
            now() > b.ends
          )
            fail("Files can be shared during a confirmed appointment.");
          const d = await body(req),
            upload = await one(
              "SELECT * FROM uploads WHERE id=? AND owner=?",
              d.upload,
              u.id,
            );
          if (!upload) fail("Upload not accessible.", 403);
          return reply(
            await save("shared-file", u.id, {
              booking: bid,
              upload: upload.id,
              name: upload.name,
            }),
            201,
          );
        }
        if (action === "messages" && method === "GET")
          return reply(
            await all(
              "SELECT m.*,u.name FROM messages m JOIN users u ON u.id=m.sender WHERE m.booking=? ORDER BY m.created",
              bid,
            ),
          );
        if (action === "messages" && method === "POST") {
          if (!["confirmed", "active"].includes(b.status))
            fail("Chat opens after payment confirmation.", 409);
          if (now() < b.starts || now() > b.ends)
            fail("Chat is available during the scheduled appointment.");
          const d = await body(req);
          await run(
            "INSERT INTO messages VALUES(?,?,?,?,?)",
            id(),
            bid,
            u.id,
            text(d.message, "Message", 5000),
            now(),
          );
          await run("UPDATE bookings SET status='active' WHERE id=?", bid);
          return reply({
            ok: true,
          });
        }
        if (action === "end" && method === "POST") {
          if (!["active", "confirmed"].includes(b.status))
            fail("This session cannot be ended.");
          if (now() < b.starts) fail("The appointment has not started.");
          await run("UPDATE bookings SET status='completed' WHERE id=?", bid);
          await audit(u.id, "session.end", bid);
          return reply({
            ok: true,
          });
        }
      }
      if (path === "/api/payments/webhook" && method === "POST") {
        let raw = "";
        for await (const c of req) {
          raw += c;
          if (raw.length > 1000000) fail("Webhook too large.", 413);
        }
        let event;
        try {
          event = verifyWebhook(
            raw,
            req.headers["stripe-signature"],
            env.STRIPE_WEBHOOK_SECRET,
          );
        } catch (e) {
          fail(e.message, e.status || 400);
        }
        const transactionResult1 = await transaction(async () => {
          if (await one("SELECT id FROM webhook_events WHERE id=?", event.id)) {
            return reply({
              received: true,
              duplicate: true,
            });
          }
          if (event.type === "checkout.session.completed") {
            const p = event.data.object;
            if (p.metadata?.order) {
              const o = await one(
                "SELECT * FROM orders WHERE id=?",
                p.metadata.order,
              );
              if (
                o &&
                p.payment_status === "paid" &&
                p.amount_total === o.total &&
                p.currency === o.currency &&
                o.status === "pending"
              ) {
                await run(
                  "UPDATE orders SET status='paid',payment_id=? WHERE id=?",
                  p.payment_intent,
                  o.id,
                );
                await audit(null, "order.paid", o.id);
              }
            }
            const b = await one(
              "SELECT * FROM bookings WHERE id=?",
              p.client_reference_id,
            );
            if (
              b &&
              p.payment_status === "paid" &&
              p.amount_total === b.amount &&
              p.currency === b.currency &&
              b.status === "pending"
            ) {
              await run(
                "UPDATE bookings SET status='confirmed',payment_id=? WHERE id=?",
                p.payment_intent,
                b.id,
              );
              await audit(null, "payment.confirmed", b.id);
              await save("notification", b.customer, {
                title: "Your appointment is confirmed",
                message:
                  "Payment has been confirmed. Open Appointments for the session details.",
              });
              await save("notification", b.reader, {
                title: "A consultation is confirmed",
                message:
                  "A paid appointment is ready in your reader workspace.",
              });
            }
          }
          if (
            ["refund.updated", "refund.failed", "refund.created"].includes(
              event.type,
            )
          ) {
            const refund = event.data.object;
            for (const r of (
              await all("SELECT * FROM records WHERE kind='refund'")
            )
              .map(parse)
              .filter((r) => r.data.providerId === refund.id)) {
              await save(
                "refund",
                r.owner,
                {
                  ...r.data,
                  status: refund.status,
                },
                r.id,
              );
              if (refund.status === "succeeded")
                await run(
                  "UPDATE bookings SET status='refunded' WHERE id=?",
                  r.data.booking,
                );
              await audit(null, "refund." + refund.status, r.id);
            }
          }
          if (event.type === "checkout.session.expired") {
            const session = event.data.object;
            await run(
              "UPDATE bookings SET status='cancelled' WHERE checkout_id=? AND status='pending'",
              session.id,
            );
            const o = await one(
              "SELECT * FROM orders WHERE checkout_id=? AND status='pending'",
              session.id,
            );
            if (o) {
              await run(
                "UPDATE orders SET status='cancelled' WHERE id=?",
                o.id,
              );
              for (const line of JSON.parse(o.lines)) {
                const r = parse(
                  await one("SELECT * FROM records WHERE id=?", line.id),
                );
                if (r)
                  await save(
                    "product",
                    r.owner,
                    {
                      ...r.data,
                      stock: r.data.stock + line.quantity,
                    },
                    r.id,
                  );
              }
              await audit(null, "order.expired", o.id);
            }
          }
          await run("INSERT INTO webhook_events VALUES(?,?)", event.id, now());
        });
        if (transactionResult1 === true) return;
        return reply({
          received: true,
        });
      }
      if (path === "/api/orders" && method === "GET") {
        requireUser();
        return reply(
          (
            await all(
              "SELECT * FROM orders WHERE customer=? ORDER BY created DESC",
              u.id,
            )
          ).map((o) => ({
            ...o,
            lines: JSON.parse(o.lines),
            address: JSON.parse(o.address),
          })),
        );
      }
      if (path === "/api/orders" && method === "POST") {
        requireUser();
        if (!u.verified) fail("Verify your email before ordering.", 403);
        const d = await body(req),
          key =
            u.id +
            ":" +
            text(req.headers["idempotency-key"], "Idempotency key", 100),
          existing = await one("SELECT * FROM orders WHERE idempotency=?", key);
        if (existing) return reply(existing);
        const address = await ownRecord(d.address, u);
        if (address.kind !== "address") fail("Select a saved address.");
        if (
          !Array.isArray(d.items) ||
          !d.items.length ||
          d.items.length > 50 ||
          new Set(d.items.map((i) => i.id)).size !== d.items.length
        )
          fail("Your cart is empty or invalid.");
        const lines = await Promise.all(
          d.items.map(async (item) => {
            const r = parse(
              await one(
                "SELECT * FROM records WHERE id=? AND kind='product'",
                item.id,
              ),
            );
            if (
              !r ||
              !Number.isInteger(item.quantity) ||
              item.quantity < 1 ||
              item.quantity > 20 ||
              r.data.stock < item.quantity
            )
              fail("A product is unavailable or has insufficient stock.", 409);
            return {
              id: r.id,
              name: r.data.name,
              price: r.data.price,
              quantity: item.quantity,
            };
          }),
        );
        const total = lines.reduce((a, l) => a + l.price * l.quantity, 0),
          oid = id();
        const transactionResult2 = await transaction(async () => {
          for (const line of lines) {
            const r = parse(
              await one("SELECT * FROM records WHERE id=?", line.id),
            );
            if (
              !r ||
              r.data.stock < line.quantity ||
              r.data.price !== line.price
            )
              fail("Stock changed. Please review your cart.", 409);
            await save(
              "product",
              r.owner,
              {
                ...r.data,
                stock: r.data.stock - line.quantity,
              },
              r.id,
            );
          }
          await run(
            "INSERT INTO orders(id,customer,status,total,address,lines,idempotency,created) VALUES(?,?,?,?,?,?,?,?)",
            oid,
            u.id,
            "pending",
            total,
            JSON.stringify(address.data),
            JSON.stringify(lines),
            key,
            now(),
          );
        });
        if (transactionResult2 === true) return;
        return reply(
          {
            id: oid,
            status: "pending",
            total,
          },
          201,
        );
      }
      if (path.startsWith("/api/orders/")) {
        requireUser();
        const [, , , oid, action] = path.split("/"),
          o = await one("SELECT * FROM orders WHERE id=?", oid);
        if (!o) fail("Order not found.", 404);
        if (o.customer !== u.id && u.role !== "admin")
          fail("Permission denied.", 403);
        if (!action && method === "GET")
          return reply({
            ...o,
            address: JSON.parse(o.address),
            lines: JSON.parse(o.lines),
          });
        if (action === "checkout" && method === "POST") {
          if (o.customer !== u.id || o.status !== "pending")
            fail("This order is not awaiting your payment.");
          const p = await stripe(
            "checkout/sessions",
            {
              mode: "payment",
              success_url: `${origin}/order-confirmation?id=${oid}`,
              cancel_url: `${origin}/order?id=${oid}`,
              "metadata[order]": oid,
              expires_at: String(Math.floor(Date.now() / 1000) + 1801),
              "line_items[0][price_data][currency]": "inr",
              "line_items[0][price_data][unit_amount]": String(o.total),
              "line_items[0][price_data][product_data][name]":
                "Flames of Shiva shop order",
              "line_items[0][quantity]": "1",
            },
            "order:" + oid,
          );
          await run(
            "UPDATE orders SET checkout_url=?,checkout_id=? WHERE id=?",
            p.url,
            p.id,
            oid,
          );
          return reply({
            url: p.url,
          });
        }
        if (action === "cancel" && method === "POST") {
          if (o.status !== "pending")
            fail(
              "Only unpaid orders can be cancelled here. Contact support for paid orders.",
            );
          if (o.checkout_id)
            await stripe(
              "checkout/sessions/" + o.checkout_id + "/expire",
              {},
              "cancel-order:" + oid,
            );
          const transactionResult3 = await transaction(async () => {
            const current = await one(
              "SELECT status FROM orders WHERE id=?",
              oid,
            );
            if (current.status !== "pending") {
              return reply({
                ok: true,
                duplicate: true,
              });
            }
            await run(
              "UPDATE orders SET status='cancelled' WHERE id=? AND status='pending'",
              oid,
            );
            for (const line of JSON.parse(o.lines)) {
              const r = parse(
                await one("SELECT * FROM records WHERE id=?", line.id),
              );
              if (r)
                await save(
                  "product",
                  r.owner,
                  {
                    ...r.data,
                    stock: r.data.stock + line.quantity,
                  },
                  r.id,
                );
            }
            await audit(u.id, "order.cancel", oid);
          });
          if (transactionResult3 === true) return;
          return reply({
            ok: true,
          });
        }
        if (action === "fulfil" && method === "POST") {
          admin();
          const d = await body(req);
          if (
            !["paid", "processing", "shipped"].includes(o.status) ||
            !["processing", "shipped", "delivered"].includes(d.status)
          )
            fail("Invalid order transition.");
          const allowed = {
            paid: "processing",
            processing: "shipped",
            shipped: "delivered",
          };
          if (allowed[o.status] !== d.status)
            fail(
              "Orders must progress through processing, shipped and delivered.",
            );
          await run("UPDATE orders SET status=? WHERE id=?", d.status, oid);
          await audit(u.id, "order." + d.status, oid);
          return reply({
            ok: true,
          });
        }
      }
      if (path === "/api/admin/payout" && method === "POST") {
        admin();
        const d = await body(req),
          reader = await one(
            "SELECT * FROM users WHERE id=? AND role='reader'",
            d.reader,
          );
        if (!reader) fail("Choose an approved reader.");
        const profile = (
          await all(
            "SELECT * FROM records WHERE owner=? AND kind='payout-details'",
            reader.id,
          )
        ).map(parse)[0];
        if (!/^acct_[a-zA-Z0-9]+$/.test(profile?.data.reference || ""))
          fail("A connected Stripe account reference is required.");
        if (!env.STRIPE_SECRET_KEY)
          fail("Payment provider setup is required before payouts.", 503);
        const payouts = (
          await all(
            "SELECT * FROM records WHERE kind='payout' AND owner=?",
            reader.id,
          )
        ).map(parse);
        let pending = payouts.find((r) => r.data.status === "pending");
        if (!pending) {
          const earned = (
            await one(
              "SELECT COALESCE(SUM(amount),0) total FROM bookings WHERE reader=? AND status='completed' AND payment_id IS NOT NULL",
              reader.id,
            )
          ).total;
          const allocated = payouts.reduce((a, r) => a + r.data.amount, 0),
            amount = earned - allocated;
          if (amount <= 0) fail("No unpaid completed-session earnings.");
          pending = await save("payout", reader.id, {
            reader: reader.id,
            amount,
            destination: profile.data.reference,
            status: "pending",
            created: now(),
          });
          await audit(u.id, "payout.reserve", pending.id);
        }
        const transfer = await stripe(
          "transfers",
          {
            amount: String(pending.data.amount),
            currency: "inr",
            destination: pending.data.destination,
          },
          "payout:" + pending.id,
        );
        await save(
          "payout",
          reader.id,
          {
            ...pending.data,
            providerId: transfer.id,
            status: "transferred",
          },
          pending.id,
        );
        await audit(u.id, "payout.transfer", transfer.id);
        return reply({
          ok: true,
        });
      }
      if (path === "/api/admin" && method === "GET") {
        admin();
        return reply({
          users: await all(
            "SELECT id,name,email,role,verified,created FROM users",
          ),
          records: (
            await all("SELECT * FROM records ORDER BY created DESC")
          ).map(parse),
          bookings: await all(
            "SELECT b.*,s.starts,s.ends FROM bookings b JOIN slots s ON s.id=b.slot",
          ),
          orders: await all("SELECT * FROM orders"),
          audit: await all(
            "SELECT * FROM audit ORDER BY created DESC LIMIT 200",
          ),
        });
      }
      if (path === "/api/admin/review" && method === "POST") {
        admin();
        const d = await body(req),
          r = parse(await one("SELECT * FROM records WHERE id=?", d.id));
        if (!r) fail("Record not found.", 404);
        if (r.kind === "application") {
          if (!["approved", "changes-requested", "rejected"].includes(d.status))
            fail("Invalid review status.");
          if (d.status === "approved")
            await run(
              "UPDATE users SET role='reader' WHERE id=? AND role='customer'",
              r.owner,
            );
          await save(
            r.kind,
            r.owner,
            {
              ...r.data,
              status: d.status,
              review: text(d.review, "Review notes", 3000),
            },
            r.id,
          );
          await audit(u.id, "application." + d.status, r.id);
          return reply({
            ok: true,
          });
        }
        if (r.kind === "refund") {
          if (d.status === "rejected") {
            await save(
              r.kind,
              r.owner,
              {
                ...r.data,
                status: "rejected",
                review: text(d.review, "Reason", 3000),
              },
              r.id,
            );
            await audit(u.id, "refund.rejected", r.id);
            return reply({
              ok: true,
            });
          }
          const b = await one(
            "SELECT * FROM bookings WHERE id=?",
            r.data.booking,
          );
          if (!b?.payment_id)
            fail("No captured payment is linked to this booking.");
          const refund = await stripe(
            "refunds",
            {
              payment_intent: b.payment_id,
            },
            "refund:" + r.id,
          );
          await save(
            r.kind,
            r.owner,
            {
              ...r.data,
              status: refund.status,
              providerId: refund.id,
            },
            r.id,
          );
          await audit(u.id, "refund." + refund.status, r.id);
          return reply({
            ok: true,
          });
        }
        fail("Unsupported review.");
      }
      if (path === "/api/reader/palmistry" && method === "GET") {
        requireUser();
        if (u.role !== "reader") fail("Reader account required.", 403);
        return reply(
          (await all("SELECT * FROM records WHERE kind='palmistry'"))
            .map(parse)
            .filter((r) => r.data.reader === u.id),
        );
      }
      if (path === "/api/admin/palmistry" && method === "POST") {
        admin();
        const d = await body(req),
          r = parse(
            await one(
              "SELECT * FROM records WHERE id=? AND kind='palmistry'",
              d.id,
            ),
          );
        if (
          !r ||
          !(await one(
            "SELECT id FROM users WHERE id=? AND role='reader'",
            d.reader,
          ))
        )
          fail("Choose a submission and approved reader.");
        await save(
          "palmistry",
          r.owner,
          {
            ...r.data,
            reader: d.reader,
            status: "assigned",
          },
          r.id,
        );
        await audit(u.id, "palmistry.assign", r.id);
        return reply({
          ok: true,
        });
      }
      if (path === "/api/reader/palmistry" && method === "POST") {
        requireUser();
        const d = await body(req),
          r = parse(
            await one(
              "SELECT * FROM records WHERE id=? AND kind='palmistry'",
              d.id,
            ),
          );
        if (!r || r.data.reader !== u.id || u.role !== "reader")
          fail("Assigned reader permission required.", 403);
        await save(
          "palmistry",
          r.owner,
          {
            ...r.data,
            report: text(d.report, "Report", 20000),
            status: "delivered",
            delivered: now(),
          },
          r.id,
        );
        await save("notification", r.owner, {
          title: "Your palm reading is ready",
          message: "Open Palmistry to read your delivered report.",
        });
        await audit(u.id, "palmistry.deliver", r.id);
        return reply({
          ok: true,
        });
      }
      if (path === "/api/admin/notify" && method === "POST") {
        admin();
        const d = await body(req);
        if (!(await one("SELECT id FROM users WHERE id=?", d.user)))
          fail("User not found.");
        await save("notification", d.user, {
          title: text(d.title, "Title", 200),
          message: text(d.message, "Message", 3000),
        });
        await audit(u.id, "notification.create", d.user);
        return reply({
          ok: true,
        });
      }
      if (path === "/api/admin/role" && method === "POST") {
        admin();
        const d = await body(req);
        if (!["customer", "reader", "admin"].includes(d.role))
          fail("Invalid role.");
        if (d.id === u.id)
          fail("Your own administrator role cannot be removed here.");
        await run("UPDATE users SET role=? WHERE id=?", d.role, d.id);
        await audit(u.id, "role." + d.role, d.id);
        return reply({
          ok: true,
        });
      }
      fail("API route not found.", 404);
    } catch (e) {
      if (/UNIQUE constraint failed/i.test(e.message))
        return reply(
          {
            error: "This item already exists or has been reserved.",
          },
          409,
        );
      if (
        !e.status &&
        /SQLITE|D1_ERROR|constraint failed|no such (table|column)/i.test(
          e.message,
        )
      ) {
        console.error("Database error", e.code);
        return reply(
          {
            error: "Unable to save. Please retry.",
          },
          500,
        );
      }
      reply(
        {
          error: e.message || "Unexpected error. Please retry.",
        },
        e.status || 400,
      );
    }
  };
}
