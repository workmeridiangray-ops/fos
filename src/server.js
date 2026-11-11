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
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  randomInt,
} from "node:crypto";
import { fileURLToPath } from "node:url";
import { kundli, numerology, tarot, birthInstant } from "./calculations.js";
import {
  sendEmail,
  stripe,
  verifyWebhook,
  astrology,
  mediaRoom,
  searchPlaces,
} from "./integrations.js";
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
const now = () => new Date().toISOString(),
  id = () => randomUUID(),
  hash = (x) => createHash("sha256").update(x).digest("hex");
const one = (sql, ...args) => db.prepare(sql).get(...args),
  all = (sql, ...args) => db.prepare(sql).all(...args),
  run = (sql, ...args) => db.prepare(sql).run(...args);
const parse = (r) => (r ? { ...r, data: JSON.parse(r.data) } : r);
function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
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
function audit(actor, action, target) {
  run(
    "INSERT INTO audit VALUES(?,?,?,?,?)",
    id(),
    actor || null,
    action,
    target,
    now(),
  );
}
function save(kind, owner, data, recordId = id()) {
  const stamp = now();
  run(
    "INSERT INTO records VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated",
    recordId,
    kind,
    owner,
    JSON.stringify(data),
    stamp,
    stamp,
  );
  return parse(one("SELECT * FROM records WHERE id=?", recordId));
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
function ownRecord(recordId, u) {
  const r = parse(one("SELECT * FROM records WHERE id=?", recordId));
  if (!r) fail("Record not found.", 404);
  if (r.owner !== u.id && u.role !== "admin") fail("Permission denied.", 403);
  return r;
}
function participant(bookingId, u) {
  const b = one(
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
  run("DELETE FROM codes WHERE user_id=? AND purpose=?", u.id, purpose);
  run(
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
  return { codeId, message: "A code was sent to your email." };
}
function verifyCode(codeId, code, purpose) {
  const r = one("SELECT * FROM codes WHERE id=?", codeId);
  if (!r || r.purpose !== purpose || r.expires < Date.now() || r.attempts >= 5)
    fail("Code expired or unavailable. Request a new one.");
  run("UPDATE codes SET attempts=attempts+1 WHERE id=?", codeId);
  if (r.hash !== hash(String(code))) fail("The code is incorrect.");
  run("DELETE FROM codes WHERE id=?", codeId);
  return r.user_id;
}
const rates = new Map();
function rate(key, max = 60) {
  const t = Date.now(),
    r = rates.get(key) || { t, n: 0 };
  if (t - r.t > 60000) {
    r.t = t;
    r.n = 0;
  }
  if (++r.n > max) fail("Too many requests. Please wait a minute.", 429);
  rates.set(key, r);
  if (rates.size > 5000)
    for (const [k, v] of rates) if (t - v.t > 60000) rates.delete(k);
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
function validateRecord(kind, d, u) {
  if (!recordKinds.includes(kind)) fail("Unknown record type.");
  if (!d || typeof d !== "object" || Array.isArray(d)) fail("Invalid record.");
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
      if (!one("SELECT id FROM uploads WHERE id=? AND owner=?", x, u.id))
        fail("Credential not accessible.");
    return { ...d, status: "submitted" };
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
    const b = participant(d.booking, u);
    if (b.reader !== u.id) fail("Assigned reader required.", 403);
    text(d.text, "Notes", 10000);
  }
  if (kind === "palmistry") {
    if (
      !["left", "right"].every((k) =>
        one(
          `SELECT id FROM uploads WHERE id=? AND owner=? AND mime IN ('image/png','image/jpeg')`,
          d[k] || "",
          u.id,
        ),
      )
    )
      fail("Upload both palm images.");
    return { ...d, status: "awaiting-reader" };
  }
  if (kind === "refund") {
    const b = participant(d.booking, u);
    if (b.customer !== u.id || b.status !== "confirmed")
      fail("A confirmed paid booking is required.");
    text(d.reason, "Reason", 2000);
    if (
      all("SELECT * FROM records WHERE kind='refund' AND owner=?", u.id)
        .map(parse)
        .some((r) => r.data.booking === b.id)
    )
      fail("A refund request already exists.", 409);
    return { ...d, status: "requested", amount: b.amount };
  }
  if (kind === "feedback") {
    const b = participant(d.booking, u);
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
    return { reference: d.reference, status: "requires-provider-verification" };
  }
  return d;
}
export const server = http.createServer(async (req, res) => {
  const origin =
    process.env.APP_ORIGIN || `http://localhost:${process.env.PORT || 3000}`;
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader(
    "X-Frame-Options",
    process.env.NODE_ENV === "production" ? "DENY" : "SAMEORIGIN",
  );
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'self'; base-uri 'self'",
  );
  const reply = (value, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  try {
    const url = new URL(req.url, origin),
      path = url.pathname,
      method = req.method;
    if (!path.startsWith("/api/")) {
      if (method !== "GET") fail("Method not allowed.", 405);
      const file = resolve(root, "public", path.slice(1));
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
    }
    if (
      ["POST", "PUT", "DELETE", "PATCH"].includes(method) &&
      path !== "/api/payments/webhook" &&
      req.headers.origin &&
      req.headers.origin !== origin
    )
      fail("Cross-origin request rejected.", 403);
    rate(req.socket.remoteAddress + ":api", 300);
    const cutoff = new Date(Date.now() - 1800000).toISOString();
    run(
      "UPDATE bookings SET status='cancelled' WHERE status='pending' AND checkout_id IS NULL AND created<?",
      cutoff,
    );
    for (const o of all(
      "SELECT * FROM orders WHERE status='pending' AND checkout_id IS NULL AND created<?",
      cutoff,
    )) {
      db.exec("BEGIN IMMEDIATE");
      try {
        run("UPDATE orders SET status='cancelled' WHERE id=?", o.id);
        for (const line of JSON.parse(o.lines)) {
          const r = parse(one("SELECT * FROM records WHERE id=?", line.id));
          if (r)
            save(
              "product",
              r.owner,
              { ...r.data, stock: r.data.stock + line.quantity },
              r.id,
            );
        }
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    }
    const token = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("session="))
      ?.slice(8);
    const u = token
      ? one(
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
      const share = one(
        "SELECT * FROM report_shares WHERE token=? AND revoked=0 AND expires>?",
        hash(tokenValue),
        Date.now(),
      );
      if (!share) fail("This shared reading has expired or been revoked.", 404);
      const r = parse(
        one("SELECT * FROM records WHERE id=? AND kind='report'", share.report),
      );
      if (!r) fail("Reading not found.", 404);
      return reply({ data: r.data, expires: share.expires });
    }
    if (path.startsWith("/api/report-shares/")) {
      requireUser();
      const reportId = path.split("/")[3],
        r = ownRecord(reportId, u);
      if (r.kind !== "report") fail("Select a saved reading.");
      if (method === "GET")
        return reply(
          all(
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
        run(
          "INSERT INTO report_shares VALUES(?,?,?,?,?,?,?)",
          shareId,
          reportId,
          u.id,
          hash(tokenValue),
          expires,
          0,
          now(),
        );
        audit(u.id, "report.share", reportId);
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
        run(
          "UPDATE report_shares SET revoked=1 WHERE report=? AND owner=?",
          reportId,
          u.id,
        );
        audit(u.id, "report.revoke", reportId);
        return reply({ ok: true });
      }
    }
    if (path === "/api/status")
      return reply({
        email: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
        payments: !!process.env.STRIPE_SECRET_KEY,
        vedic: !!process.env.ASTROLOGY_PROVIDER_URL,
        voiceVideo: !!process.env.DAILY_API_KEY,
        storage: "Private local disk",
        development: process.env.NODE_ENV !== "production",
      });
    if (path === "/api/me" && method === "GET")
      return reply({ user: safeUser(u) });
    if (path === "/api/auth/signup" && method === "POST") {
      rate(req.socket.remoteAddress + ":auth", 15);
      const d = await body(req),
        email = text(d.email, "Email", 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail("Enter a valid email.");
      const name = text(d.name, "Name", 120),
        pw = password(d.password);
      if (one("SELECT id FROM users WHERE email=?", email))
        fail(
          "An account already exists. Sign in or recover your password.",
          409,
        );
      const userId = id();
      run(
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
      rate(req.socket.remoteAddress + ":auth", 15);
      const d = await body(req),
        user = one(
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
      run(
        "INSERT INTO sessions VALUES(?,?,?)",
        hash(t),
        user.id,
        Date.now() + 86400000 * 7,
      );
      res.setHeader(
        "Set-Cookie",
        `session=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
      );
      return reply({ user: safeUser(user) });
    }
    if (path === "/api/auth/logout" && method === "POST") {
      if (token) run("DELETE FROM sessions WHERE token=?", hash(token));
      res.setHeader(
        "Set-Cookie",
        "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
      );
      return reply({ ok: true });
    }
    if (path === "/api/auth/request-code" && method === "POST") {
      rate(req.socket.remoteAddress + ":codes", 5);
      const d = await body(req);
      if (d.purpose === "reset") {
        const target = one(
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
        r = one("SELECT user_id FROM codes WHERE id=?", d.codeId);
      if (r?.user_id !== u.id) fail("Code not accessible.", 403);
      verifyCode(d.codeId, d.code, "verify");
      run(
        "UPDATE users SET verified=1,role=CASE WHEN email=? THEN 'admin' ELSE role END WHERE id=?",
        process.env.ADMIN_EMAIL || "",
        u.id,
      );
      return reply({ verified: true });
    }
    if (path === "/api/auth/reset" && method === "POST") {
      const d = await body(req),
        pw = password(d.password),
        uid = verifyCode(d.codeId, d.code, "reset");
      run("UPDATE users SET password=? WHERE id=?", pw, uid);
      run("DELETE FROM sessions WHERE user_id=?", uid);
      return reply({ ok: true });
    }
    if (path === "/api/me" && method === "PATCH") {
      requireUser();
      const d = await body(req);
      run(
        "UPDATE users SET name=? WHERE id=?",
        text(d.name, "Name", 120),
        u.id,
      );
      return reply({
        user: safeUser(one("SELECT * FROM users WHERE id=?", u.id)),
      });
    }
    if (path === "/api/readers") {
      const readers = all(
        "SELECT r.*,u.verified FROM records r JOIN users u ON u.id=r.owner WHERE r.kind='reader-profile' AND u.role='reader'",
      )
        .map(parse)
        .map((r) => ({ id: r.owner, ...r.data }));
      return reply(readers);
    }
    if (path === "/api/catalog") {
      return reply(
        Object.fromEntries(
          publicKinds.map((k) => [
            k,
            all(
              "SELECT * FROM records WHERE kind=? ORDER BY created DESC",
              k,
            ).map(parse),
          ]),
        ),
      );
    }
    if (path === "/api/records" && method === "GET") {
      requireUser();
      const kind = url.searchParams.get("kind");
      if (!recordKinds.includes(kind)) fail("Unknown record type.");
      return reply(
        all(
          "SELECT * FROM records WHERE owner=? AND kind=? ORDER BY created DESC",
          u.id,
          kind,
        ).map(parse),
      );
    }
    if (path === "/api/records" && method === "POST") {
      requireUser();
      const d = await body(req),
        data = validateRecord(d.kind, d.data, u);
      const saved = save(d.kind, u.id, data);
      audit(u.id, "record.create", saved.id);
      return reply(saved, 201);
    }
    if (path.startsWith("/api/records/")) {
      requireUser();
      const r = ownRecord(path.split("/")[3], u);
      if (method === "GET") return reply(r);
      if (method === "DELETE") {
        if (["refund", "application", "payout"].includes(r.kind))
          fail("This record must be retained for review.");
        run("DELETE FROM records WHERE id=?", r.id);
        audit(u.id, "record.delete", r.id);
        return reply({ ok: true });
      }
      if (method === "PATCH") {
        const d = await body(req);
        if (r.kind === "ticket") {
          const message = text(d.reply, "Reply", 5000);
          return reply(
            save(
              "ticket",
              r.owner,
              {
                ...r.data,
                status: d.close ? "closed" : r.data.status,
                replies: [
                  ...r.data.replies,
                  { author: u.name, body: message, created: now() },
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
        const updated = save(
          r.kind,
          r.owner,
          validateRecord(r.kind, d, u),
          r.id,
        );
        audit(u.id, "record.update", r.id);
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
          bytes = await sharp(bytes, { limitInputPixels: 40000000 })
            .rotate()
            .resize({
              width: 2500,
              height: 2500,
              fit: "inside",
              withoutEnlargement: true,
            })
            .toFormat(mime === "image/png" ? "png" : "jpeg")
            .toBuffer();
        } catch {
          fail("This image is damaged or cannot be safely decoded.");
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
      writeFileSync(join(dataDir, "uploads", uid), bytes, { mode: 0o600 });
      run(
        "INSERT INTO uploads VALUES(?,?,?,?,?,?)",
        uid,
        u.id,
        mime,
        text(d.name, "File name", 200),
        bytes.length,
        now(),
      );
      return reply({ id: uid, mime, size: bytes.length }, 201);
    }
    if (path.startsWith("/api/uploads/") && method === "GET") {
      requireUser();
      const f = one("SELECT * FROM uploads WHERE id=?", path.split("/")[3]);
      if (!f) fail("File not found.", 404);
      if (f.owner !== u.id && u.role !== "admin") {
        const palmAccess = all("SELECT * FROM records WHERE kind='palmistry'")
          .map(parse)
          .some(
            (r) =>
              r.data.reader === u.id &&
              [r.data.left, r.data.right].includes(f.id),
          );
        const sharedAccess = all(
          "SELECT * FROM records WHERE kind='shared-file'",
        )
          .map(parse)
          .some(
            (r) =>
              r.data.upload === f.id &&
              one(
                "SELECT id FROM bookings WHERE id=? AND (customer=? OR reader=?)",
                r.data.booking,
                u.id,
                u.id,
              ),
          );
        const authorised = palmAccess || sharedAccess;
        if (!authorised) fail("Private upload.", 403);
      }
      res.writeHead(200, {
        "Content-Type": f.mime,
        "Content-Disposition": `attachment; filename="${f.id}${f.mime === "application/pdf" ? ".pdf" : f.mime === "image/png" ? ".png" : ".jpg"}"`,
      });
      return res.end(readFileSync(join(dataDir, "uploads", f.id)));
    }
    if (path === "/api/slots" && method === "GET") {
      const reader = url.searchParams.get("reader");
      return reply(
        all(
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
        one(
          "SELECT id FROM slots WHERE reader=? AND starts<? AND ends>?",
          u.id,
          end.toISOString(),
          start.toISOString(),
        )
      )
        fail("This slot overlaps an existing slot.", 409);
      const sid = id();
      run(
        "INSERT INTO slots VALUES(?,?,?,?,?)",
        sid,
        u.id,
        start.toISOString(),
        end.toISOString(),
        price,
      );
      return reply({ id: sid }, 201);
    }

    if (path.startsWith("/api/slots/") && method === "DELETE") {
      requireUser();
      const sid = path.split("/")[3],
        slot = one("SELECT * FROM slots WHERE id=?", sid);
      if (!slot || slot.reader !== u.id) fail("Slot not accessible.", 403);
      if (one("SELECT id FROM bookings WHERE slot=?", sid))
        fail("A slot linked to a booking must be retained.");
      run("DELETE FROM slots WHERE id=?", sid);
      audit(u.id, "availability.remove", sid);
      return reply({ ok: true });
    }
    if (path === "/api/bookings" && method === "GET") {
      requireUser();
      return reply(
        all(
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
        existing = one(
          "SELECT * FROM bookings WHERE idempotency=?",
          u.id + ":" + key,
        );
      if (existing) return reply(existing);
      const slot = one(
        "SELECT s.* FROM slots s JOIN users u ON u.id=s.reader WHERE s.id=? AND u.role='reader'",
        d.slot,
      );
      if (!slot || slot.starts <= now())
        fail("This slot is no longer available.", 409);
      if (!["chat", "voice", "video"].includes(d.format))
        fail("Choose a session format.");
      if (d.format !== "chat" && !process.env.DAILY_API_KEY)
        fail(
          "Voice and video require a configured communication provider.",
          503,
        );
      const intake = text(d.intake, "Consultation focus", 3000),
        bid = id();
      try {
        run(
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
      audit(u.id, "booking.reserve", bid);
      return reply(one("SELECT * FROM bookings WHERE id=?", bid), 201);
    }
    if (path.startsWith("/api/bookings/")) {
      requireUser();
      const [, , , bid, action] = path.split("/");
      const b = participant(bid, u);
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
        run(
          "UPDATE bookings SET checkout_url=?,checkout_id=? WHERE id=?",
          result.url,
          result.id,
          bid,
        );
        return reply({ url: result.url });
      }
      if (action === "cancel" && method === "POST") {
        if (b.status !== "pending")
          fail("Paid bookings need a refund review; request a refund instead.");
        if (b.checkout_id)
          await stripe(
            "checkout/sessions/" + b.checkout_id + "/expire",
            {},
            "cancel:" + bid,
          );
        run("UPDATE bookings SET status='cancelled' WHERE id=?", bid);
        audit(u.id, "booking.cancel", bid);
        return reply({ ok: true });
      }
      if (action === "reschedule" && method === "POST") {
        if (!["confirmed", "pending"].includes(b.status))
          fail("This booking cannot be rescheduled.");
        const d = await body(req),
          s = one(
            "SELECT * FROM slots WHERE id=? AND reader=?",
            d.slot,
            b.reader,
          );
        if (!s || s.starts <= now() || s.price !== b.amount)
          fail("Select a future slot with the same reader and price.");
        try {
          run("UPDATE bookings SET slot=? WHERE id=?", s.id, bid);
        } catch {
          fail("The new slot is already reserved.", 409);
        }
        audit(u.id, "booking.reschedule", bid);
        return reply({ ok: true });
      }

      if (action === "files" && method === "GET")
        return reply(
          all("SELECT * FROM records WHERE kind='shared-file'")
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
          upload = one(
            "SELECT * FROM uploads WHERE id=? AND owner=?",
            d.upload,
            u.id,
          );
        if (!upload) fail("Upload not accessible.", 403);
        return reply(
          save("shared-file", u.id, {
            booking: bid,
            upload: upload.id,
            name: upload.name,
          }),
          201,
        );
      }
      if (action === "messages" && method === "GET")
        return reply(
          all(
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
        run(
          "INSERT INTO messages VALUES(?,?,?,?,?)",
          id(),
          bid,
          u.id,
          text(d.message, "Message", 5000),
          now(),
        );
        run("UPDATE bookings SET status='active' WHERE id=?", bid);
        return reply({ ok: true });
      }
      if (action === "end" && method === "POST") {
        if (!["active", "confirmed"].includes(b.status))
          fail("This session cannot be ended.");
        if (now() < b.starts) fail("The appointment has not started.");
        run("UPDATE bookings SET status='completed' WHERE id=?", bid);
        audit(u.id, "session.end", bid);
        return reply({ ok: true });
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
          process.env.STRIPE_WEBHOOK_SECRET,
        );
      } catch (e) {
        fail(e.message, e.status || 400);
      }
      db.exec("BEGIN IMMEDIATE");
      try {
        if (one("SELECT id FROM webhook_events WHERE id=?", event.id)) {
          db.exec("COMMIT");
          return reply({ received: true, duplicate: true });
        }
        if (event.type === "checkout.session.completed") {
          const p = event.data.object;
          if (p.metadata?.order) {
            const o = one("SELECT * FROM orders WHERE id=?", p.metadata.order);
            if (
              o &&
              p.payment_status === "paid" &&
              p.amount_total === o.total &&
              p.currency === o.currency &&
              o.status === "pending"
            ) {
              run(
                "UPDATE orders SET status='paid',payment_id=? WHERE id=?",
                p.payment_intent,
                o.id,
              );
              audit(null, "order.paid", o.id);
            }
          }
          const b = one(
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
            run(
              "UPDATE bookings SET status='confirmed',payment_id=? WHERE id=?",
              p.payment_intent,
              b.id,
            );
            audit(null, "payment.confirmed", b.id);
            save("notification", b.customer, {
              title: "Your appointment is confirmed",
              message:
                "Payment has been confirmed. Open Appointments for the session details.",
            });
            save("notification", b.reader, {
              title: "A consultation is confirmed",
              message: "A paid appointment is ready in your reader workspace.",
            });
          }
        }
        if (
          ["refund.updated", "refund.failed", "refund.created"].includes(
            event.type,
          )
        ) {
          const refund = event.data.object;
          for (const r of all("SELECT * FROM records WHERE kind='refund'")
            .map(parse)
            .filter((r) => r.data.providerId === refund.id)) {
            save("refund", r.owner, { ...r.data, status: refund.status }, r.id);
            if (refund.status === "succeeded")
              run(
                "UPDATE bookings SET status='refunded' WHERE id=?",
                r.data.booking,
              );
            audit(null, "refund." + refund.status, r.id);
          }
        }
        if (event.type === "checkout.session.expired") {
          const session = event.data.object;
          run(
            "UPDATE bookings SET status='cancelled' WHERE checkout_id=? AND status='pending'",
            session.id,
          );
          const o = one(
            "SELECT * FROM orders WHERE checkout_id=? AND status='pending'",
            session.id,
          );
          if (o) {
            run("UPDATE orders SET status='cancelled' WHERE id=?", o.id);
            for (const line of JSON.parse(o.lines)) {
              const r = parse(one("SELECT * FROM records WHERE id=?", line.id));
              if (r)
                save(
                  "product",
                  r.owner,
                  { ...r.data, stock: r.data.stock + line.quantity },
                  r.id,
                );
            }
            audit(null, "order.expired", o.id);
          }
        }
        run("INSERT INTO webhook_events VALUES(?,?)", event.id, now());
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return reply({ received: true });
    }

    if (path === "/api/orders" && method === "GET") {
      requireUser();
      return reply(
        all(
          "SELECT * FROM orders WHERE customer=? ORDER BY created DESC",
          u.id,
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
        existing = one("SELECT * FROM orders WHERE idempotency=?", key);
      if (existing) return reply(existing);
      const address = ownRecord(d.address, u);
      if (address.kind !== "address") fail("Select a saved address.");
      if (
        !Array.isArray(d.items) ||
        !d.items.length ||
        d.items.length > 50 ||
        new Set(d.items.map((i) => i.id)).size !== d.items.length
      )
        fail("Your cart is empty or invalid.");
      const lines = d.items.map((item) => {
        const r = parse(
          one("SELECT * FROM records WHERE id=? AND kind='product'", item.id),
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
      });
      const total = lines.reduce((a, l) => a + l.price * l.quantity, 0),
        oid = id();
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const line of lines) {
          const r = parse(one("SELECT * FROM records WHERE id=?", line.id));
          if (r.data.stock < line.quantity)
            fail("Stock changed. Please review your cart.", 409);
          save(
            "product",
            r.owner,
            { ...r.data, stock: r.data.stock - line.quantity },
            r.id,
          );
        }
        run(
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
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return reply({ id: oid, status: "pending", total }, 201);
    }
    if (path.startsWith("/api/orders/")) {
      requireUser();
      const [, , , oid, action] = path.split("/"),
        o = one("SELECT * FROM orders WHERE id=?", oid);
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
        run(
          "UPDATE orders SET checkout_url=?,checkout_id=? WHERE id=?",
          p.url,
          p.id,
          oid,
        );
        return reply({ url: p.url });
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
        db.exec("BEGIN IMMEDIATE");
        try {
          const transition = run(
            "UPDATE orders SET status='cancelled' WHERE id=? AND status='pending'",
            oid,
          );
          if (!transition.changes) {
            db.exec("COMMIT");
            return reply({ ok: true, duplicate: true });
          }
          for (const line of JSON.parse(o.lines)) {
            const r = parse(one("SELECT * FROM records WHERE id=?", line.id));
            if (r)
              save(
                "product",
                r.owner,
                { ...r.data, stock: r.data.stock + line.quantity },
                r.id,
              );
          }
          audit(u.id, "order.cancel", oid);
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
        return reply({ ok: true });
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
        run("UPDATE orders SET status=? WHERE id=?", d.status, oid);
        audit(u.id, "order." + d.status, oid);
        return reply({ ok: true });
      }
    }
    if (path === "/api/admin/payout" && method === "POST") {
      admin();
      const d = await body(req),
        reader = one(
          "SELECT * FROM users WHERE id=? AND role='reader'",
          d.reader,
        );
      if (!reader) fail("Choose an approved reader.");
      const profile = all(
        "SELECT * FROM records WHERE owner=? AND kind='payout-details'",
        reader.id,
      ).map(parse)[0];
      if (!/^acct_[a-zA-Z0-9]+$/.test(profile?.data.reference || ""))
        fail("A connected Stripe account reference is required.");
      if (!process.env.STRIPE_SECRET_KEY)
        fail("Payment provider setup is required before payouts.", 503);
      const payouts = all(
        "SELECT * FROM records WHERE kind='payout' AND owner=?",
        reader.id,
      ).map(parse);
      let pending = payouts.find((r) => r.data.status === "pending");
      if (!pending) {
        const earned = one(
          "SELECT COALESCE(SUM(amount),0) total FROM bookings WHERE reader=? AND status='completed' AND payment_id IS NOT NULL",
          reader.id,
        ).total;
        const allocated = payouts.reduce((a, r) => a + r.data.amount, 0),
          amount = earned - allocated;
        if (amount <= 0) fail("No unpaid completed-session earnings.");
        pending = save("payout", reader.id, {
          reader: reader.id,
          amount,
          destination: profile.data.reference,
          status: "pending",
          created: now(),
        });
        audit(u.id, "payout.reserve", pending.id);
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
      save(
        "payout",
        reader.id,
        { ...pending.data, providerId: transfer.id, status: "transferred" },
        pending.id,
      );
      audit(u.id, "payout.transfer", transfer.id);
      return reply({ ok: true });
    }
    if (path === "/api/admin" && method === "GET") {
      admin();
      return reply({
        users: all("SELECT id,name,email,role,verified,created FROM users"),
        records: all("SELECT * FROM records ORDER BY created DESC").map(parse),
        bookings: all(
          "SELECT b.*,s.starts,s.ends FROM bookings b JOIN slots s ON s.id=b.slot",
        ),
        orders: all("SELECT * FROM orders"),
        audit: all("SELECT * FROM audit ORDER BY created DESC LIMIT 200"),
      });
    }
    if (path === "/api/admin/review" && method === "POST") {
      admin();
      const d = await body(req),
        r = parse(one("SELECT * FROM records WHERE id=?", d.id));
      if (!r) fail("Record not found.", 404);
      if (r.kind === "application") {
        if (!["approved", "changes-requested", "rejected"].includes(d.status))
          fail("Invalid review status.");
        if (d.status === "approved")
          run(
            "UPDATE users SET role='reader' WHERE id=? AND role='customer'",
            r.owner,
          );
        save(
          r.kind,
          r.owner,
          {
            ...r.data,
            status: d.status,
            review: text(d.review, "Review notes", 3000),
          },
          r.id,
        );
        audit(u.id, "application." + d.status, r.id);
        return reply({ ok: true });
      }
      if (r.kind === "refund") {
        if (d.status === "rejected") {
          save(
            r.kind,
            r.owner,
            {
              ...r.data,
              status: "rejected",
              review: text(d.review, "Reason", 3000),
            },
            r.id,
          );
          audit(u.id, "refund.rejected", r.id);
          return reply({ ok: true });
        }
        const b = one("SELECT * FROM bookings WHERE id=?", r.data.booking);
        if (!b?.payment_id)
          fail("No captured payment is linked to this booking.");
        const refund = await stripe(
          "refunds",
          { payment_intent: b.payment_id },
          "refund:" + r.id,
        );
        save(
          r.kind,
          r.owner,
          { ...r.data, status: refund.status, providerId: refund.id },
          r.id,
        );
        audit(u.id, "refund." + refund.status, r.id);
        return reply({ ok: true });
      }
      fail("Unsupported review.");
    }

    if (path === "/api/reader/palmistry" && method === "GET") {
      requireUser();
      if (u.role !== "reader") fail("Reader account required.", 403);
      return reply(
        all("SELECT * FROM records WHERE kind='palmistry'")
          .map(parse)
          .filter((r) => r.data.reader === u.id),
      );
    }
    if (path === "/api/admin/palmistry" && method === "POST") {
      admin();
      const d = await body(req),
        r = parse(
          one("SELECT * FROM records WHERE id=? AND kind='palmistry'", d.id),
        );
      if (
        !r ||
        !one("SELECT id FROM users WHERE id=? AND role='reader'", d.reader)
      )
        fail("Choose a submission and approved reader.");
      save(
        "palmistry",
        r.owner,
        { ...r.data, reader: d.reader, status: "assigned" },
        r.id,
      );
      audit(u.id, "palmistry.assign", r.id);
      return reply({ ok: true });
    }
    if (path === "/api/reader/palmistry" && method === "POST") {
      requireUser();
      const d = await body(req),
        r = parse(
          one("SELECT * FROM records WHERE id=? AND kind='palmistry'", d.id),
        );
      if (!r || r.data.reader !== u.id || u.role !== "reader")
        fail("Assigned reader permission required.", 403);
      save(
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
      save("notification", r.owner, {
        title: "Your palm reading is ready",
        message: "Open Palmistry to read your delivered report.",
      });
      audit(u.id, "palmistry.deliver", r.id);
      return reply({ ok: true });
    }
    if (path === "/api/admin/notify" && method === "POST") {
      admin();
      const d = await body(req);
      if (!one("SELECT id FROM users WHERE id=?", d.user))
        fail("User not found.");
      save("notification", d.user, {
        title: text(d.title, "Title", 200),
        message: text(d.message, "Message", 3000),
      });
      audit(u.id, "notification.create", d.user);
      return reply({ ok: true });
    }
    if (path === "/api/admin/role" && method === "POST") {
      admin();
      const d = await body(req);
      if (!["customer", "reader", "admin"].includes(d.role))
        fail("Invalid role.");
      if (d.id === u.id)
        fail("Your own administrator role cannot be removed here.");
      run("UPDATE users SET role=? WHERE id=?", d.role, d.id);
      audit(u.id, "role." + d.role, d.id);
      return reply({ ok: true });
    }
    fail("API route not found.", 404);
  } catch (e) {
    if (e.code === "ERR_SQLITE_ERROR" && /UNIQUE/.test(e.message))
      return reply(
        { error: "This item already exists or has been reserved." },
        409,
      );
    if (!e.status && e.message?.includes("SQLITE")) {
      console.error("Database error", e.code);
      return reply({ error: "Unable to save. Please retry." }, 500);
    }
    reply(
      { error: e.message || "Unexpected error. Please retry." },
      e.status || 400,
    );
  }
});
if (process.env.NODE_ENV !== "test")
  server.listen(
    Number(process.env.PORT || 3000),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        `Flames of Shiva: http://localhost:${process.env.PORT || 3000}`,
      ),
  );
