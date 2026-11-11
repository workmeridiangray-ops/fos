const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n / 100);
const localTime = (s) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(s));
let user = null,
  status = {},
  catalog = {},
  report = null,
  tarotState = { question: "", spread: "three", positions: [] },
  timer = null;
const services = [
  [
    "kundli",
    "Vedic astrology",
    "Explore your birth chart, planetary placements and life cycles.",
    "☉",
    "Create your kundli",
  ],
  [
    "tarot-reading",
    "Tarot reading",
    "Pause with a question. Make room for a fresh perspective.",
    "✧",
    "Explore tarot",
  ],
  [
    "numerology",
    "Numerology",
    "Discover the patterns within your name and birth date.",
    "Ⅸ",
    "Discover your numbers",
  ],
  [
    "palmistry-upload",
    "Palmistry",
    "Explore the lines and patterns that make your palms unique.",
    "☽",
    "Explore palmistry",
  ],
];
async function api(path, method = "GET", data, headers = {}) {
  const r = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let value;
  try {
    value = await r.json();
  } catch {
    throw Error("The server could not respond. Please retry.");
  }
  if (!r.ok) {
    const e = Error(value.error || "Request failed.");
    e.status = r.status;
    throw e;
  }
  return value;
}
function toast(message) {
  $("#toast").textContent = message;
  setTimeout(() => ($("#toast").textContent = ""), 5000);
}
function go(path) {
  history.pushState({}, "", path);
  render();
  window.scrollTo(0, 0);
}
const link = (path, label, cls = "") =>
  `<a href="${esc(path)}" class="${cls}">${label}</a>`;
const btn = (label, action, cls = "") =>
  `<button type="button" class="btn ${cls}" data-action="${action}">${label}</button>`;
const field = (name, label, type = "text", value = "", extra = "") =>
  `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const area = (name, label, value = "", extra = "") =>
  `<label class="field full">${label}<textarea name="${name}" ${extra}>${esc(value)}</textarea></label>`;
const select = (name, label, values, value) =>
  `<label class="field">${label}<select name="${name}">${values
    .map((v) => {
      const [val, txt] = Array.isArray(v) ? v : [v, v];
      return `<option value="${esc(val)}" ${val === value ? "selected" : ""}>${esc(txt)}</option>`;
    })
    .join("")}</select></label>`;
const notice = (message, success = false) =>
  `<div class="notice ${success ? "success" : ""}" role="status">${message}</div>`;
const empty = (title, message, action = "") =>
  `<div class="empty"><span class="icon" aria-hidden="true">✧</span><h3>${title}</h3><p>${message}</p>${action}</div>`;
function shell() {
  const p = location.pathname;
  $("#header").innerHTML =
    `<div class="container nav">${link("/", '<img src="/assets/wordmark-trim.webp" alt="Flames of Shiva" width="218" height="58">', "brand")}<button class="menu-button" type="button" aria-label="Toggle navigation" aria-expanded="false">Menu ☰</button><nav aria-label="Main navigation">${[
      ["/", "Home"],
      ["/explore-readings", "Readings"],
      ["/kundli", "Kundli"],
      ["/reader-search", "Our readers"],
      ["/about", "Our story"],
      ["/shop", "Shop"],
    ]
      .map(([href, label]) => link(href, label, p === href ? "active" : ""))
      .join(
        "",
      )}${link(user ? "/customer-dashboard" : "/sign-in", user ? "My account ↗" : "Sign in ↗", "nav-account")}</nav></div>`;
  $(".menu-button").onclick = () => {
    const n = $("nav");
    n.classList.toggle("open");
    $(".menu-button").setAttribute(
      "aria-expanded",
      n.classList.contains("open"),
    );
  };
  $("#footer").innerHTML =
    `<div class="container"><div class="footer-grid"><div><div class="footer-brand">Flames of Shiva</div><p>A thoughtful space for ancient wisdom, personal reflection and a deeper understanding of yourself.</p></div><div><h4>Explore the practices</h4><div class="footer-links">${services.map((s) => link("/" + s[0], s[1])).join("")}${link("/compatibility-details", "Compatibility")}</div></div><div><h4>Your journey</h4><div class="footer-links">${link("/reader-search", "Find a reader")}${link("/customer-dashboard", "Your account")}${link("/blog", "The journal")}${link("/daily-horoscope", "Daily horoscope")}</div></div><div><h4>Here to help</h4><div class="footer-links">${link("/about", "Our story")}${link("/help", "Help centre")}${link("/contact", "Contact us")}${link("/reader-application", "Become a reader")}</div></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Flames of Shiva. All rights reserved.</span><span>Spiritual practices offer reflection. Your choices remain your own.</span></div></div>`;
}
const sidebarLinks = [
  ["/customer-dashboard", "Overview"],
  ["/birth-profiles", "Birth profiles"],
  ["/my-readings", "My readings"],
  ["/appointments", "Appointments"],
  ["/favourites", "Favourites"],
  ["/orders", "Shop orders"],
  ["/transactions", "Transactions"],
  ["/refunds", "Refund requests"],
  ["/notifications", "Notifications"],
  ["/support", "Support"],
  ["/account", "Account settings"],
];
function sidebar() {
  let links = [...sidebarLinks];
  if (user?.role === "reader")
    links.push(
      ["/reader-dashboard", "Reader workspace"],
      ["/availability", "Availability"],
      ["/reader-settings", "Reader profile"],
      ["/reader-notes", "Private notes"],
      ["/reader-palmistry", "Palmistry requests"],
      ["/earnings", "Earnings"],
      ["/payout-details", "Payout details"],
    );
  if (user?.role === "admin") links.push(["/admin", "Administration"]);
  return `<aside class="sidebar" aria-label="Account navigation"><strong>YOUR SPACE</strong>${links.map(([p, l]) => link(p, l, location.pathname === p ? "active" : "")).join("")}</aside>`;
}
function page(title, desc, content, workspace = false) {
  $("#main").innerHTML =
    `<div class="container page"><div class="breadcrumb">${link("/", "Home")}<span>/</span><span>${esc(title)}</span></div><div class="${workspace ? "workspace" : ""}">${workspace ? sidebar() : ""}<div><div class="page-intro"><h1>${esc(title)}</h1>${desc ? `<p>${desc}</p>` : ""}</div>${content}</div></div></div>`;
}
function form(id, content, label = "Save", cls = "") {
  return `<form id="${id}" class="${cls}"><div class="form-grid">${content}</div><div class="actions"><button class="btn primary" type="submit">${label} <span aria-hidden="true">→</span></button></div><div class="form-result" aria-live="polite"></div></form>`;
}
function bindForm(id, handler) {
  const f = $("#" + id);
  if (!f) return;
  f.onsubmit = async (e) => {
    e.preventDefault();
    const b = f.querySelector("[type=submit]");
    b.disabled = true;
    const result = f.querySelector(".form-result");
    result.innerHTML = "";
    try {
      await handler(Object.fromEntries(new FormData(f)), f);
    } catch (err) {
      result.innerHTML = `<div class="form-error" role="alert">${esc(err.message)}</div>`;
    } finally {
      b.disabled = false;
    }
  };
}
function requireLogin() {
  if (user) return true;
  page(
    "Your private space",
    "Sign in to keep your readings, profiles and appointments together.",
    empty(
      "Make room for your journey",
      "Your personal details are visible only to you and authorised readers.",
      link(
        "/sign-in?next=" + encodeURIComponent(location.pathname),
        "Sign in →",
        "btn primary",
      ) +
        " " +
        link("/sign-up", "Create an account", "btn"),
    ),
  );
  return false;
}
const recs = (kind) => api("/records?kind=" + kind);
async function saveRecord(kind, data, recordId) {
  return recordId
    ? api("/records/" + recordId, "PATCH", data)
    : api("/records", "POST", { kind, data });
}
function home() {
  $("#main").innerHTML =
    `<section class="container hero"><div><div class="eyebrow">Align · Reflect · Discover</div><h1>Discover the cosmic<br>blueprint of <em>your life.</em></h1><p>A thoughtful space for Vedic astrology, tarot and numerology. Find a practice that speaks to you.</p><div class="actions">${link("/birth-details", "Create your kundli <span>↗</span>", "btn primary")}${link("/explore-readings", "Explore readings <span>→</span>", "btn")}</div></div><div class="hero-art"><img src="/assets/emblem-trim.webp" alt="The Flames of Shiva golden celestial flame surrounded by planets" width="1040" height="1065" fetchpriority="high"><span class="orbit-label">ANCIENT WISDOM. YOUR OWN PATH.</span></div></section><div class="practice-strip"><div class="container"><div><span class="icon">☉</span> Rooted in ancient traditions</div><div><span class="icon">✧</span> A personal perspective</div><div><span class="icon">☽</span> Space for reflection</div><div><span class="icon">↗</span> Guided by your curiosity</div></div></div><section class="section container"><div class="section-head"><h2>Many paths. Your own perspective.</h2><p>Let curiosity guide you. Explore a practice that meets you where you are.</p></div><div class="services">${services.map((s) => `<a class="service-card" href="/${s[0]}"><span class="service-symbol" aria-hidden="true">${s[3]}</span><h3>${s[1]}</h3><p>${s[2]}</p><span class="text-link">${s[4]} &nbsp; ↗</span></a>`).join("")}</div></section><section class="section soft"><div class="container split"><div class="image-panel"><img src="/assets/tarot.webp" alt="Celestial tarot artwork from the Flames of Shiva design project" loading="lazy"></div><div><h2>A little perspective.<br>A deeper connection.</h2><p>Some questions ask us to look inward. Others invite us to see the bigger picture. Our readings give you space to explore both.</p><p>Approach each practice with openness, keep what resonates, and choose your own next step.</p>${link("/about", "The story behind Flames of Shiva →", "text-link")}</div></div></section><section class="section container"><div class="section-head"><h2>Your journey starts with a question.</h2><p>There is no right place to begin. Just a little curiosity.</p></div><div class="steps"><div class="step"><span class="step-number">01</span><h3>Find your practice</h3><p>Explore astrology, tarot, numerology or palmistry and see what draws you in.</p></div><div class="step"><span class="step-number">02</span><h3>Make it personal</h3><p>Bring your birth details, a question, or simply the wish to understand yourself.</p></div><div class="step"><span class="step-number">03</span><h3>Reflect and explore</h3><p>Save your reading, revisit an insight, or continue the conversation with a reader.</p></div></div></section><section class="soft"><div class="container newsletter"><div><h3>A conversation can open a new perspective.</h3><p>Find a reader whose approach feels right for you.</p></div>${link("/reader-search", "Explore our readers ↗", "btn primary")}</div></section>`;
}
async function serviceDirectory() {
  page(
    "Find your own path",
    "Explore practices for self-discovery, reflection and a fresh perspective.",
    `<div class="services">${services.map((s) => `<a class="service-card" href="/${s[0]}"><span class="service-symbol">${s[3]}</span><h3>${s[1]}</h3><p>${s[2]}</p><span class="text-link">Explore practice →</span></a>`).join("")}</div><div class="panel"><h3>Explore together</h3><p>Compare two birth profiles using a configured Vedic calculation provider.</p>${link("/compatibility-details", "Explore compatibility →", "text-link")}</div>`,
  );
  const serviceRows = (await api("/catalog")).service;
  if (serviceRows.length) {
    const box = document.createElement("div");
    box.className = "grid-3";
    box.innerHTML = serviceRows
      .map(
        (r) =>
          `<div class="panel"><h3>${esc(r.data.title)}</h3><p>${esc(r.data.summary)}</p>${link("/services/" + r.id, "Explore this service →", "text-link")}</div>`,
      )
      .join("");
    $(".page-intro").parentElement.append(box);
  }
}
function about() {
  page(
    "Ancient wisdom. An open mind.",
    "A space to explore the questions that make us human.",
    `<div class="split"><div><h2>Understanding begins<br>with curiosity.</h2><p>Flames of Shiva brings astrology and spiritual reading practices into a thoughtful, accessible space. Each practice offers a different way to pause, reflect and consider your direction.</p><p>We believe in making room for questions without taking away your agency. A reading can offer perspective; the decisions are always yours.</p><div class="actions">${link("/explore-readings", "Explore the practices →", "btn primary")}</div></div><div class="hero-art"><img src="/assets/emblem-trim.webp" alt="Flames of Shiva celestial emblem"></div></div><div class="steps"><div class="step"><h3>Clear assumptions</h3><p>Calculation methods and any limitations are shown alongside your results.</p></div><div class="step"><h3>Personal by design</h3><p>Birth profiles and saved readings stay within your private account.</p></div><div class="step"><h3>Room for choice</h3><p>Use every reading as a starting point for reflection, with your own judgement at the centre.</p></div></div>`,
  );
}
function authPage(mode) {
  const signup = mode === "sign-up",
    reset = mode === "reset-password",
    forgot = mode === "forgot-password",
    verify = mode === "otp-verification";
  const title = signup
    ? "Begin your journey"
    : reset
      ? "A fresh start"
      : forgot
        ? "Find your way back"
        : verify
          ? "Verify your email"
          : "Welcome back";
  page(
    title,
    "",
    `<div class="auth-layout"><div class="auth-art"><img src="/assets/emblem-trim.webp" alt="Celestial flame emblem"><h2>A space for your<br>own discoveries.</h2><p>Save your readings. Return to an insight.<br>Explore at your own pace.</p></div><div class="auth-form"><h2>${title}</h2><p>${signup ? "Create an account to keep your journey together." : forgot ? "We will send a password reset code to your email." : verify ? "Confirm your email before booking a consultation." : reset ? "Use your emailed code to set a new password." : "Your reflections and discoveries are waiting."}</p>${form("auth", `${signup ? field("name", "Your name", "text", "", 'required maxlength="120" autocomplete="name"') : ""}${!verify && !reset ? field("email", "Email address", "email", "", 'required autocomplete="email"') : ""}${!forgot && !verify ? field("password", signup || reset ? "Create a password" : "Password", "password", "", 'required minlength="12" maxlength="200" autocomplete="' + (signup || reset ? "new-password" : "current-password") + '"') : ""}${verify || reset ? field("code", "Six-digit code", "text", "", 'required inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code"') : ""}`, signup ? "Create account" : forgot ? "Send reset code" : verify ? "Verify email" : reset ? "Reset password" : "Sign in")}${verify ? btn("Send a new code", "send-code", "small") : ""}<p>${signup ? `Already have an account? ${link("/sign-in", "Sign in", "text-link")}` : !forgot && !verify && !reset ? `${link("/forgot-password", "Forgot password?", "text-link")}<br><br>New here? ${link("/sign-up", "Create your account", "text-link")}` : link("/sign-in", "Return to sign in", "text-link")}</p></div></div>`,
  );
  bindForm("auth", async (d) => {
    if (signup) {
      await api("/auth/signup", "POST", d);
      toast("Account created. Sign in to continue.");
      go("/sign-in");
    } else if (forgot) {
      const r = await api("/auth/request-code", "POST", {
        ...d,
        purpose: "reset",
      });
      sessionStorage.setItem("resetCodeId", r.codeId || "");
      toast(r.message);
      if (r.codeId) go("/reset-password");
    } else if (reset) {
      await api("/auth/reset", "POST", {
        ...d,
        codeId: sessionStorage.getItem("resetCodeId"),
      });
      toast("Password reset. Please sign in.");
      go("/sign-in");
    } else if (verify) {
      await api("/auth/verify", "POST", {
        ...d,
        codeId: sessionStorage.getItem("verifyCodeId"),
      });
      user = (await api("/me")).user;
      toast("Email verified.");
      go("/customer-dashboard");
    } else {
      user = (await api("/auth/login", "POST", d)).user;
      const next = new URLSearchParams(location.search).get("next");
      go(
        next?.startsWith("/") && !next.startsWith("//")
          ? next
          : "/customer-dashboard",
      );
    }
  });
}
async function dashboard() {
  if (!requireLogin()) return;
  const [profiles, reports, bookings] = await Promise.all([
    recs("profile"),
    recs("report"),
    api("/bookings"),
  ]);
  page(
    `Welcome, ${user.name.split(" ")[0]}.`,
    "A place for your readings, reflections and next steps.",
    `${!user.verified ? notice(`Your email is not verified. ${link("/otp-verification", "Verify your email →", "text-link")}`) : ""}<div class="grid-3"><div class="stat"><strong>${reports.length}</strong><p>Saved readings</p></div><div class="stat"><strong>${profiles.length}</strong><p>Birth profiles</p></div><div class="stat"><strong>${bookings.filter((b) => ["pending", "confirmed", "active"].includes(b.status)).length}</strong><p>Upcoming appointments</p></div></div><div class="panel"><h2>What would you like to explore?</h2><p>Start with a practice or return to a saved reading.</p><div class="actions">${link("/birth-details", "Create a birth chart →", "btn primary")}${link("/tarot-reading", "Ask the cards", "btn")}${link("/numerology", "Explore your numbers", "btn")}</div></div><h3>Your recent readings</h3><div class="toolbar"></div>${reports.length ? reports.slice(0, 3).map(reportRow).join("") : empty("Your story is still unfolding", "Save your first reading and return to it whenever you like.", link("/explore-readings", "Find a practice →", "btn"))}`,
    true,
  );
}
function birthFields(prefix = "", data = {}) {
  return `${field(prefix + "name", "Full name", "text", data.name || "", 'required maxlength="120"')}${field(prefix + "date", "Date of birth", "date", data.date || "", 'required max="' + new Date().toISOString().slice(0, 10) + '"')}${field(prefix + "time", "Time of birth", "time", data.time || "", "")}${field(prefix + "timezone", "Birth timezone (IANA name or UTC offset)", "text", data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, 'required list="timezones"')}<datalist id="timezones">${["Asia/Kolkata", "Europe/London", "America/New_York", "America/Los_Angeles", "Europe/Paris", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney", "UTC", ...Intl.supportedValuesOf("timeZone")].map((t) => `<option>${esc(t)}</option>`).join("")}</datalist><label class="checkbox field full"><span><input type="checkbox" name="${prefix}unknownTime" ${data.unknownTime ? "checked" : ""}> I do not know the birth time</span><small>We use local noon for approximate planetary positions and do not infer an ascendant.</small></label>${field(prefix + "place", "Birthplace", "text", data.place || "", 'required list="places" placeholder="Search by city or enter a place"')}${field(prefix + "latitude", "Latitude", "number", data.latitude ?? "", 'required min="-90" max="90" step="any" placeholder="e.g. 18.5204"')}${field(prefix + "longitude", "Longitude", "number", data.longitude ?? "", 'required min="-180" max="180" step="any" placeholder="e.g. 73.8567"')}<datalist id="places"><option>Pune, India</option><option>Mumbai, India</option><option>Delhi, India</option><option>London, United Kingdom</option><option>New York, United States</option></datalist>`;
}
function bindPlaces() {
  $$("input[name$=place]").forEach((el) => {
    if (el.parentElement.querySelector(".place-search")) return;
    const wrap = document.createElement("div");
    wrap.className = "place-search";
    wrap.innerHTML =
      '<button class="btn small" type="button">Search birthplace</button><div class="place-results" aria-live="polite"></div>';
    el.parentElement.append(wrap);
    wrap.querySelector("button").onclick = async () => {
      const result = wrap.querySelector(".place-results");
      result.innerHTML = "Searching…";
      try {
        const rows = await api("/places?q=" + encodeURIComponent(el.value));
        result.innerHTML = rows.length
          ? rows
              .map(
                (r, i) =>
                  `<button type="button" class="btn small" data-place-result="${i}">${esc(r.name)}</button>`,
              )
              .join("")
          : "No matching places. Enter coordinates manually.";
        wrap.querySelectorAll("[data-place-result]").forEach(
          (b) =>
            (b.onclick = () => {
              const r = rows[Number(b.dataset.placeResult)],
                prefix = el.name.slice(0, -5);
              el.value = r.name;
              for (const k of ["latitude", "longitude", "timezone"])
                el.form.elements[prefix + k].value = r[k];
              result.innerHTML =
                "Coordinates and timezone selected. Check that this is your birthplace.";
            }),
        );
      } catch (e) {
        result.innerHTML = esc(e.message);
      }
    };
  });

  const places = {
    "Pune, India": [18.5204, 73.8567, "Asia/Kolkata"],
    "Mumbai, India": [19.076, 72.8777, "Asia/Kolkata"],
    "Delhi, India": [28.6139, 77.209, "Asia/Kolkata"],
    "London, United Kingdom": [51.5074, -0.1278, "Europe/London"],
    "New York, United States": [40.7128, -74.006, "America/New_York"],
  };
  $$("input[name$=place]").forEach((el) => {
    el.onchange = () => {
      const p = places[el.value];
      if (p) {
        const prefix = el.name.slice(0, -5),
          f = el.form;
        f.elements[prefix + "latitude"].value = p[0];
        f.elements[prefix + "longitude"].value = p[1];
        f.elements[prefix + "timezone"].value = p[2];
      }
    };
  });
  $$("input[name$=unknownTime]").forEach((el) => {
    el.onchange = () => {
      const t = el.form.elements[el.name.replace("unknownTime", "time")];
      t.disabled = el.checked;
    };
    el.onchange();
  });
}
function normalBirth(d, prefix = "") {
  const r = {};
  for (const k of [
    "name",
    "date",
    "time",
    "timezone",
    "place",
    "latitude",
    "longitude",
  ])
    r[k] = d[prefix + k];
  r.unknownTime = d[prefix + "unknownTime"] === "on";
  return r;
}
async function profiles(edit = false) {
  if (!requireLogin()) return;
  const list = await recs("profile"),
    rid = new URLSearchParams(location.search).get("id"),
    r = list.find((x) => x.id === rid);
  if (edit) {
    page(
      r ? "Edit birth profile" : "A profile for your discoveries",
      "Your birth details are saved privately to your account.",
      `<div class="panel">${form("profile", birthFields("", r?.data), "Save birth profile")}</div>`,
      true,
    );
    bindPlaces();
    bindForm("profile", async (d) => {
      await saveRecord("profile", normalBirth(d), r?.id);
      toast("Birth profile saved.");
      go("/birth-profiles");
    });
  } else {
    page(
      "Your birth profiles",
      "Keep the details that make your readings personal.",
      `<div class="actions">${link("/profile-edit", "Add a birth profile +", "btn primary")}</div><br>${list.length ? list.map((r) => `<div class="row-card"><div><h3>${esc(r.data.name)}</h3><p>${esc(r.data.date)} · ${esc(r.data.place)} · ${r.data.unknownTime ? "Time unknown" : esc(r.data.time)}</p></div><div class="actions">${link("/profile-edit?id=" + r.id, "Edit", "btn small")}${btn("Delete", "delete:" + r.id, "small")}</div></div>`).join("") : empty("A personal starting point", "Add your birth details once and use them again for future readings.")}`,
      true,
    );
  }
}
function kundliIntro() {
  page(
    "Your celestial starting point",
    "Explore planetary positions at the moment of your birth.",
    `<div class="split"><div class="panel"><h2>Begin with your birth details.</h2><p>Enter your date, time and place of birth to calculate astronomical planetary positions. Every report records the timezone, coordinates and calculation conventions.</p>${notice("The built-in calculator provides genuine tropical planetary positions. Complete Vedic sidereal charts, dashas and interpretations require the Vedic provider.")}${link("/birth-details", "Enter birth details →", "btn primary")}</div><div class="hero-art"><img src="/assets/emblem-trim.webp" alt="Celestial flame and planets"></div></div>`,
  );
}
async function birthPage() {
  if (!requireLogin()) return;
  const profiles = await recs("profile");
  page(
    "The moment your story began",
    "A few details help us place the planets in your sky.",
    `<div class="grid-2"><div class="panel">${profiles.length ? select("savedProfile", "Use a saved profile", [["", "Enter new details"], ...profiles.map((r) => [r.id, r.data.name])]) : ""}<br>${form("birth", birthFields() + `<label class="checkbox field full"><span><input type="checkbox" name="vedic"> Request a complete Vedic report through the configured provider</span></label>`, "Calculate my chart")}</div><aside class="panel"><h3>Getting the details right</h3><p>Use the local time recorded at your birthplace. The selected timezone determines the UTC conversion.</p><p>If you do not know the time, select “unknown”. We use local noon and clearly mark the limitation.</p><p>The city list includes five reference locations. For another birthplace, enter its coordinates and select or enter the correct timezone.</p>${notice("Your full birth details are private. Only save profiles you have permission to use.")}</aside></div>`,
  );
  bindPlaces();
  if ($("[name=savedProfile]"))
    $("[name=savedProfile]").onchange = (e) => {
      const d = profiles.find((r) => r.id === e.target.value)?.data;
      if (d) {
        for (const [k, v] of Object.entries(d)) {
          const el = $("#birth").elements[k];
          if (el) {
            if (el.type === "checkbox") el.checked = v;
            else el.value = v;
          }
        }
        bindPlaces();
      }
    };
  bindForm("birth", async (d, f) => {
    f.querySelector(".form-result").innerHTML = notice(
      "Calculating planetary positions. Please keep this page open.",
    );
    report = await api("/calculate", "POST", {
      type: "kundli",
      ...normalBirth(d),
      vedic: d.vedic === "on",
    });
    go("/kundli-overview");
  });
}
function reportRow(r) {
  return `<div class="row-card"><div><span class="badge">${esc(r.data.type)}</span><h3>${esc(r.data.name || r.data.question || "Personal reading")}</h3><p>Saved ${localTime(r.created)}</p></div><div class="actions">${btn("Open reading →", "open-report:" + r.id, "small")}${btn("Delete", "delete:" + r.id, "small")}</div></div>`;
}
function reportActions() {
  return `<div class="actions no-print">${btn("Save reading", "save-report", "primary")}${btn("Print / Save PDF", "print")}${btn("Share summary", "share")}${btn("Create a reading link", "share-report")}${btn("Revoke reading links", "revoke-report")}${link("/reader-search", "Discuss with a reader →", "btn")}</div><div id="report-feedback" aria-live="polite"></div>`;
}
function reportPage(kind) {
  if (!report || report.type !== kind) {
    page(
      "Your reading",
      "",
      empty(
        "No reading selected",
        "Calculate a new reading or open one you have saved.",
        link(
          kind === "numerology"
            ? "/numerology"
            : kind === "tarot"
              ? "/tarot-reading"
              : kind === "compatibility"
                ? "/compatibility-details"
                : "/birth-details",
          "Start a reading →",
          "btn primary",
        ) +
          " " +
          link("/my-readings", "Saved readings", "btn"),
      ),
    );
    return;
  }
  if (kind === "numerology") {
    page(
      "The numbers in your story",
      `A symbolic reading for ${esc(report.name)}.`,
      `${notice("For personal reflection. Numerology is not a scientific prediction.")}<div class="grid-3">${report.numbers.map((n) => `<div class="number-card"><h3>${esc(n.key.replace(/([A-Z])/g, " $1").toUpperCase())}</h3><strong>${n.number}</strong><p>${esc(n.meaning)}</p></div>`).join("")}</div><br><div class="panel"><h3>How your numbers are calculated</h3><p>${esc(report.method)}</p></div>${reportActions()}`,
    );
  }
  if (kind === "tarot") {
    page(
      "A moment of perspective",
      esc(report.question),
      `<div class="tarot-cards">${report.cards.map((c) => `<div class="tarot-card"><small>${esc(c.position)}</small><span aria-hidden="true">✧</span><strong>${esc(c.name)}</strong></div>`).join("")}</div><div class="grid-${report.cards.length === 1 ? "2" : "3"}">${report.cards.map((c) => `<div class="panel"><span class="badge">${esc(c.position)}</span><br><br><h3>${esc(c.theme)}</h3><p>${esc(c.reflection)}</p></div>`).join("")}</div>${notice(esc(report.method))}${reportActions()}`,
    );
  }
  if (kind === "kundli") {
    page(
      "Your celestial blueprint",
      `Planetary positions for ${esc(report.name || report.input?.name || "your birth details")}.`,
      `<div class="tabs" role="tablist">${["Overview", "Planetary positions", "Rashi chart", "Dasha timeline", "Yogas & doshas", "Remedies", "D9 Navamsa", "Life predictions", "Calculation details"].map((t, i) => `<button role="tab" aria-selected="${i === 0}" class="${i === 0 ? "active" : ""}" data-tab="${i}">${t}</button>`).join("")}</div><div id="chart-tab"></div>${reportActions()}`,
    );
    const show = (i) => {
      const positions = `<div class="panel"><h3>Tropical planetary positions</h3><p>Geocentric ecliptic longitude of date. These positions have not been converted to sidereal signs.</p><div class="table-wrap"><table><thead><tr><th>Body</th><th>Tropical sign</th><th>Degree in sign</th><th>Longitude</th></tr></thead><tbody>${report.planets?.map((p) => `<tr><td>${esc(p.body)}</td><td>${esc(p.sign)}</td><td>${p.degree}°</td><td>${p.longitude}°</td></tr>`).join("") || ""}</tbody></table></div></div>`;
      $("#chart-tab").innerHTML =
        i === 0
          ? notice(esc(report.notice || "Provider report")) + positions
          : i === 1
            ? positions
            : i === 8
              ? `<div class="panel"><h3>Calculation assumptions</h3><pre>${esc(JSON.stringify(report.assumptions, null, 2))}</pre></div>`
              : report.report
                ? `<div class="panel"><pre>${esc(JSON.stringify(report.report, null, 2))}</pre></div>`
                : empty(
                    "Vedic calculation provider required",
                    "This section needs sidereal calculations and documented interpretation rules. No chart or prediction has been invented.",
                    link(
                      "/reader-search",
                      "Explore reader consultations →",
                      "btn",
                    ),
                  );
      $$("[data-tab]").forEach((b, j) => {
        b.classList.toggle("active", j === i);
        b.setAttribute("aria-selected", j === i);
        b.tabIndex = j === i ? 0 : -1;
      });
    };
    $$("[data-tab]").forEach((b, i) => {
      b.onclick = () => show(i);
      b.onkeydown = (e) => {
        if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          const n = (i + (e.key === "ArrowRight" ? 1 : 8)) % 9;
          show(n);
          $$("[data-tab]")[n].focus();
        }
      };
    });
    const chartTab = {
      "/planet-details": 1,
      "/planetary-positions": 1,
      "/rashi-chart": 2,
      "/dasha-timeline": 3,
      "/vimshottari-dasha": 3,
      "/important-yogas": 4,
      "/dosha-analysis": 4,
      "/personalized-remedies": 5,
      "/d9-navamsa": 6,
      "/life-predictions": 7,
    };
    show(chartTab[location.pathname] || 0);
  }
  if (kind === "compatibility") {
    page(
      "Your compatibility reading",
      "A perspective on two birth profiles.",
      `<div class="panel"><pre>${esc(JSON.stringify(report.report, null, 2))}</pre><h3>Calculation assumptions</h3><pre>${esc(JSON.stringify(report.assumptions, null, 2))}</pre></div>${reportActions()}`,
    );
  }
}
function numerologyPage() {
  page(
    "The patterns in your name",
    "Explore the symbolic numbers connected with your name and date of birth.",
    `<div class="grid-2"><div class="panel"><h2>Every name has a rhythm.</h2><p>Start with the name you want to explore and your birth date.</p>${form("numbers", field("name", "Full name", "text", "", 'required maxlength="120" placeholder="Your full name"') + field("date", "Date of birth", "date", "", "required"), "Discover my numbers")}</div><div class="panel"><h3>A practice of reflection</h3><p>We use the Pythagorean letter system and show your life path, expression, soul urge, personality and birthday numbers.</p><p>Master numbers 11, 22 and 33 are preserved during reduction. For names in another script, use a Latin-letter transliteration.</p>${notice("These meanings are symbolic prompts, not factual predictions about your personality or future.")}</div></div>`,
  );
  bindForm("numbers", async (d) => {
    report = await api("/calculate", "POST", { ...d, type: "numerology" });
    go("/numerology-report");
  });
}
function tarotPage(stage = "intro") {
  if (stage === "intro") {
    page(
      "A question. A pause. A perspective.",
      "Let the cards be a starting point for your own reflection.",
      `<div class="split"><div class="panel"><h2>What is on your mind?</h2><p>Bring an open question about a situation you would like to explore.</p>${form("tarot-question", area("question", "Your question", tarotState.question, 'required maxlength="1000" placeholder="What would help me see this situation more clearly?"'), "Choose your spread")}</div><div class="image-panel"><img src="/assets/tarot.webp" alt="Tarot and celestial objects"></div></div>${notice("This reading uses 22 Major Arcana with upright interpretations. The cards offer reflection, rather than certainty or advice for high-stakes decisions.")}`,
    );
    bindForm("tarot-question", (d) => {
      tarotState.question = d.question;
      tarotState.positions = [];
      go("/tarot-spread");
    });
  } else if (!tarotState.question) {
    go("/tarot-reading");
  } else if (stage === "spread") {
    page(
      "Choose your spread",
      esc(tarotState.question),
      `<div class="grid-2"><div class="panel"><span class="icon">✧</span><h2>A single reflection</h2><p>One card to help you pause and consider your question from another angle.</p>${btn("Choose one card →", "spread:one", "primary")}</div><div class="panel"><span class="icon">✧ ✧ ✧</span><h2>A wider perspective</h2><p>Three cards exploring past influences, present focus and a possible direction.</p>${btn("Choose three cards →", "spread:three", "primary")}</div></div>`,
    );
  } else {
    const count = tarotState.spread === "one" ? 1 : 3;
    page(
      "Choose the cards that draw you in",
      `Select ${count} ${count === 1 ? "card" : "cards"}. There is no wrong choice.`,
      `<div class="panel"><div class="deck">${Array.from({ length: 22 }, (_, i) => `<button type="button" aria-label="Select card ${i + 1}" aria-pressed="${tarotState.positions.includes(i)}" class="${tarotState.positions.includes(i) ? "selected" : ""}" data-card="${i}">✧</button>`).join("")}</div><p id="selection-count" role="status">${tarotState.positions.length} of ${count} cards selected</p>${btn("Reveal my reading →", "reveal", "primary")}<div id="reveal-error" role="alert"></div></div>${notice("A secure shuffle assigns cards when you reveal your selection. Selected positions are unique; cards are drawn without replacement.")}`,
    );
    $$("[data-card]").forEach(
      (b) =>
        (b.onclick = () => {
          const i = Number(b.dataset.card);
          if (tarotState.positions.includes(i))
            tarotState.positions = tarotState.positions.filter((x) => x !== i);
          else if (tarotState.positions.length < count)
            tarotState.positions.push(i);
          b.classList.toggle("selected", tarotState.positions.includes(i));
          b.setAttribute("aria-pressed", tarotState.positions.includes(i));
          $("#selection-count").textContent =
            `${tarotState.positions.length} of ${count} cards selected`;
        }),
    );
  }
}
async function compatibility() {
  if (!requireLogin()) return;
  page(
    "Two stories, explored together",
    "Enter both birth profiles to request a compatibility report.",
    `<div class="panel">${form("compatibility", `<div><h3>First person</h3><br><div class="form-grid">${birthFields("first_")}</div></div><div><h3>Second person</h3><br><div class="form-grid">${birthFields("second_")}</div></div>`, "Calculate compatibility")}</div>${notice("Compatibility requires a documented Vedic provider. Scores are never substituted with random or illustrative values. Use birth details only with permission.")}`,
  );
  bindPlaces();
  bindForm("compatibility", async (d) => {
    report = await api("/calculate", "POST", {
      type: "compatibility",
      first: normalBirth(d, "first_"),
      second: normalBirth(d, "second_"),
    });
    go("/compatibility-report");
  });
}
async function uploadFile(file, imagesOnly = false) {
  if (!file) throw Error("Choose a file to upload.");
  if (file.size > 5000000) throw Error("Choose a file smaller than 5 MB.");
  if (imagesOnly && !["image/jpeg", "image/png"].includes(file.type))
    throw Error("Choose a PNG or JPEG palm image.");
  const base64 = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(Error("Unable to read file."));
    r.readAsDataURL(file);
  });
  return api("/uploads", "POST", { name: file.name, base64 });
}
async function palmistry() {
  if (!requireLogin()) return;
  const entries = await recs("palmistry");
  page(
    "Your hands, a personal story",
    "Submit clear images for a reader to review.",
    `<div class="grid-2"><div class="panel">${form("palms", `<label class="field full">Left palm<input type="file" name="left" accept="image/png,image/jpeg" required></label><label class="field full">Right palm<input type="file" name="right" accept="image/png,image/jpeg" required></label>${area("question", "What would you like to explore?", "", 'maxlength="2000"')}`, "Submit palm images")}</div><div class="panel"><h3>A clearer view</h3><p>Use natural light and a plain background. Hold your palm open, fingers relaxed, and include the wrist. Avoid shadows and blurred images.</p><p>PNG and JPEG images up to 5 MB each are accepted. Images stay private in your account.</p>${notice("Submitting images does not create an appointment. Choose a reader separately for a consultation.")}${link("/reader-search", "Find a reader →", "btn")}</div></div>${entries.length ? "<h3>Your submissions</h3><br>" + entries.map((r) => `<div class="row-card"><div><h3>${esc(r.data.question || "Palm reading request")}</h3><p>${localTime(r.created)}</p></div><span class="badge">${esc(r.data.status)}</span>${r.data.report ? `<div class="panel"><h3>Your delivered reading</h3><p>${esc(r.data.report)}</p>${btn("Print / Save PDF", "print")}</div>` : ""}</div>`).join("") : ""}`,
  );
  bindForm("palms", async (d, f) => {
    const left = await uploadFile(f.elements.left.files[0], true),
      right = await uploadFile(f.elements.right.files[0], true);
    await saveRecord("palmistry", {
      left: left.id,
      right: right.id,
      question: d.question,
    });
    toast("Palm images submitted privately.");
    render();
  });
}
async function readers(profile = false) {
  const readers = await api("/readers"),
    rid = new URLSearchParams(location.search).get("id");
  if (profile) {
    const r = readers.find((x) => x.id === rid);
    if (!r) {
      page(
        "Reader profile",
        "",
        empty(
          "No reader selected",
          "Explore the directory to choose a reader.",
          link("/reader-search", "Find a reader →", "btn primary"),
        ),
      );
      return;
    }
    page(
      r.name,
      esc(r.services || "Spiritual readings"),
      `<div class="grid-2"><div class="panel"><div class="reader-avatar">${esc(r.name[0])}</div><br><h2>${esc(r.name)}</h2><p>${esc(r.bio)}</p><p>Languages: ${esc(r.languages)}</p><div class="actions">${link("/booking?reader=" + r.id, "View availability →", "btn primary")}${btn("Save to favourites", "favourite:" + r.id)}</div></div><div class="panel"><h3>A conversation at your pace</h3><p>Browse actual availability and review the session price before reserving a time.</p>${notice("Reader credentials are reviewed through the application workflow. No ratings or verification claims are shown without supporting records.")}</div></div>`,
    );
    return;
  }
  page(
    "Find a reader who speaks to you",
    "Explore an approach, a language, a conversation.",
    `<div class="toolbar"><input id="reader-query" aria-label="Search readers" placeholder="Search name, practice or language"><select id="reader-language" aria-label="Filter language"><option value="">All languages</option>${[...new Set(readers.flatMap((r) => r.languages.split(",").map((x) => x.trim())))].map((l) => `<option>${esc(l)}</option>`).join("")}</select></div><div id="reader-results"></div>`,
  );
  const show = () => {
    const q = $("#reader-query").value.toLowerCase(),
      l = $("#reader-language").value;
    const filtered = readers.filter(
      (r) =>
        (r.name + " " + r.bio + " " + r.languages + " " + r.services)
          .toLowerCase()
          .includes(q) &&
        (!l || r.languages.includes(l)),
    );
    $("#reader-results").innerHTML = filtered.length
      ? `<div class="grid-3">${filtered.map((r) => `<div class="panel"><div class="reader-avatar">${esc(r.name[0])}</div><br><h3>${esc(r.name)}</h3><p>${esc(r.services)}</p><p>${esc(r.bio.slice(0, 160))}</p><p>${esc(r.languages)}</p>${link("/reader-profile?id=" + r.id, "Meet your reader →", "text-link")}</div>`).join("")}</div>`
      : empty(
          readers.length
            ? "No readers match your search"
            : "The reader directory is being prepared",
          readers.length
            ? "Try another name, practice or language."
            : "Reader profiles appear here after an application is approved and profile setup is complete.",
          link("/reader-application", "Apply as a reader →", "btn"),
        );
  };
  $("#reader-query").oninput = show;
  $("#reader-language").onchange = show;
  show();
}
async function bookingPage() {
  if (!requireLogin()) return;
  const readers = await api("/readers"),
    rid = new URLSearchParams(location.search).get("reader"),
    r = readers.find((r) => r.id === rid);
  if (!r) {
    page(
      "Book a conversation",
      "",
      empty(
        "Start with a reader",
        "Choose a reader, then explore their availability.",
        link("/reader-search", "Explore readers →", "btn primary"),
      ),
    );
    return;
  }
  const slots = await api("/slots?reader=" + rid);
  let chosen = null;
  const key = crypto.randomUUID();
  page(
    "A time for your questions",
    `Book a conversation with ${esc(r.name)}.`,
    `<div class="grid-2"><div class="panel"><h3>Choose an available time</h3><p>All times shown in ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}.</p>${slots.length ? `<div class="slot-grid">${slots.map((s) => `<button class="btn small" type="button" data-slot="${s.id}">${localTime(s.starts)} · ${money(s.price)}</button>`).join("")}</div>` : empty("No open times yet", "This reader has not published any future slots. Please return later or explore another reader.", link("/reader-search", "Explore readers →", "text-link"))}<br>${form(
      "booking",
      select("format", "Session format", [
        ["chat", "Live chat"],
        ["voice", status.voiceVideo ? "Voice call" : "Voice · setup required"],
        ["video", status.voiceVideo ? "Video call" : "Video · setup required"],
      ]) +
        area(
          "intake",
          "What would you like to discuss?",
          "",
          'required maxlength="3000"',
        ),
      "Reserve this time",
    )}</div><div class="panel"><h3>Your appointment</h3><p>${esc(r.name)} · ${esc(r.services)}</p><div id="booking-summary">${notice("Select a time to see the duration and price.")}</div><p>A reservation holds the slot pending payment. Confirmation is issued only after a verified payment notification.</p>${notice(!status.payments ? "Payment provider setup is required. No payment can be taken until it is configured." : "You will be redirected to the payment provider for secure checkout.")}</div></div>`,
  );
  $$("[data-slot]").forEach(
    (b) =>
      (b.onclick = () => {
        chosen = slots.find((s) => s.id === b.dataset.slot);
        $$("[data-slot]").forEach((x) =>
          x.classList.toggle("selected", x === b),
        );
        $("#booking-summary").innerHTML =
          `<p>${localTime(chosen.starts)}</p><p>${Math.round((new Date(chosen.ends) - new Date(chosen.starts)) / 60000)} minutes</p><h2>${money(chosen.price)}</h2>`;
      }),
  );
  bindForm("booking", async (d) => {
    if (!chosen) throw Error("Select an available time.");
    const b = await api(
      "/bookings",
      "POST",
      { ...d, slot: chosen.id },
      { "Idempotency-Key": key },
    );
    go("/payment?id=" + b.id);
  });
}
async function paymentPage(confirmation = false) {
  if (!requireLogin()) return;
  const bid = new URLSearchParams(location.search).get("id");
  if (!bid) {
    go("/appointments");
    return;
  }
  const b = await api("/bookings/" + bid);
  page(
    confirmation ? "Your booking status" : "Review your appointment",
    confirmation
      ? "Confirmation follows a verified payment notification."
      : "Check the details before continuing to secure payment.",
    `<div class="panel"><span class="badge">${esc(b.status)}</span><br><br><h2>${localTime(b.starts)}</h2><p>${esc(b.format)} · ${Math.round((new Date(b.ends) - new Date(b.starts)) / 60000)} minutes · ${money(b.amount)}</p><p>${esc(b.intake)}</p>${b.status === "pending" ? notice("This appointment is reserved pending payment. A return from checkout is not proof of payment.") : b.status === "confirmed" ? notice("Payment confirmed. Your appointment is booked.", true) : ""}<div class="actions">${b.status === "pending" ? btn("Continue to secure payment ↗", "checkout:" + b.id, "primary") : link("/live-session?id=" + b.id, "Open consultation →", "btn primary")}${link("/appointments", "Manage appointments", "btn")}</div><div id="payment-result" role="status"></div></div>`,
  );
}
async function appointments() {
  if (!requireLogin()) return;
  const list = await api("/bookings");
  page(
    "Your appointments",
    "Make room for your next conversation.",
    list.length
      ? list
          .map(
            (b) =>
              `<div class="row-card"><div><span class="badge">${esc(b.status)}</span><h3>${esc(b.reader_name)}</h3><p>${localTime(b.starts)} · ${esc(b.format)} · ${money(b.amount)}</p></div><div class="actions">${link("/manage-appointment?id=" + b.id, "Manage →", "btn small")}${["confirmed", "active"].includes(b.status) ? link("/live-session?id=" + b.id, "Open session", "btn small primary") : ""}</div></div>`,
          )
          .join("")
      : empty(
          "A conversation starts here",
          "When you book a reader, your appointments will appear here.",
          link("/reader-search", "Find a reader →", "btn primary"),
        ),
    true,
  );
}
async function manageAppointment() {
  if (!requireLogin()) return;
  const bid = new URLSearchParams(location.search).get("id");
  if (!bid) {
    go("/appointments");
    return;
  }
  const b = await api("/bookings/" + bid),
    slots = await api("/slots?reader=" + b.reader);
  page(
    "Manage your appointment",
    localTime(b.starts),
    `<div class="panel"><span class="badge">${esc(b.status)}</span><p>${esc(b.intake)}</p><p>${esc(b.format)} · ${money(b.amount)}</p><div class="actions">${b.status === "pending" ? btn("Cancel reservation", "cancel:" + b.id) : ""}${b.status === "pending" ? link("/payment?id=" + b.id, "Complete payment →", "btn primary") : ""}${b.status === "confirmed" ? link("/refunds?booking=" + b.id, "Request a refund", "btn") : ""}${link("/live-session?id=" + b.id, "Open session →", "btn")}</div></div>${["pending", "confirmed"].includes(b.status) ? `<div class="panel"><h3>Move to another time</h3><p>Choose a future slot with the same reader and session price.</p>${form("reschedule", select("slot", "New appointment time", [["", "Choose a time"], ...slots.filter((s) => s.price === b.amount).map((s) => [s.id, localTime(s.starts)])]), "Reschedule appointment")}</div>` : ""}`,
    true,
  );
  bindForm("reschedule", async (d) => {
    await api("/bookings/" + bid + "/reschedule", "POST", d);
    toast("Appointment rescheduled.");
    render();
  });
}
async function liveSession(summary = false) {
  if (!requireLogin()) return;
  const bid = new URLSearchParams(location.search).get("id");
  if (!bid) {
    go("/appointments");
    return;
  }
  const b = await api("/bookings/" + bid);
  if (summary || b.status === "completed") {
    page(
      "A moment to reflect",
      "Your consultation summary.",
      `<div class="panel"><span class="badge">${esc(b.status)}</span><h3>${localTime(b.starts)}</h3><p>${esc(b.intake)}</p><p>Session notes remain private to your reader. You can revisit your chat below.</p><div id="messages" class="messages"></div>${form(
        "feedback",
        select("rating", "Your experience", [
          ["5", "5 · Very helpful"],
          ["4", "4 · Helpful"],
          ["3", "3 · Neutral"],
          ["2", "2 · Less helpful"],
          ["1", "1 · Unhelpful"],
        ]) +
          area(
            "comment",
            "What would you like us to know?",
            "",
            'maxlength="2000"',
          ),
        "Send feedback",
      )}<div class="actions">${link("/booking?reader=" + b.reader, "Book another conversation →", "btn")}</div></div>`,
      true,
    );
    bindForm("feedback", async (d) => {
      await saveRecord("feedback", { ...d, booking: bid });
      toast("Thank you. Your feedback is saved privately.");
    });
  } else {
    page(
      "Your consultation space",
      `${localTime(b.starts)} · ${esc(b.format)}`,
      `<div class="panel"><div class="row-card"><div><span class="badge" id="connection">Connecting</span><p id="session-clock"></p></div>${btn("End session", "end-session:" + bid, "small")}</div>${!["confirmed", "active"].includes(b.status) ? notice("This session is not confirmed. Chat opens only after verified payment.") : ""}${nowBefore(b.starts) ? notice("You are in the waiting room. Messaging opens at the scheduled start time.") : ""}<div id="messages" class="messages" aria-live="polite"></div>${form("chat", area("message", "Your message", "", 'required maxlength="5000"'), "Send message")}<details><summary>Share a file with your reader</summary>${form("session-file", '<label class="field full">Image or PDF<input type="file" name="file" accept="image/png,image/jpeg,application/pdf" required></label>', "Share file")}<div id="shared-files"></div></details><div class="actions">${btn("Reconnect", "reconnect:" + bid, "small")}${btn("Voice / video options", "media-options:" + bid, "small")}</div><div id="media-status"></div></div>`,
      true,
    );
    bindForm("chat", async (d) => {
      await api("/bookings/" + bid + "/messages", "POST", d);
      $("#chat").reset();
      await refreshMessages(bid);
    });
    bindForm("session-file", async (d, f) => {
      const upload = await uploadFile(f.elements.file.files[0]);
      await api("/bookings/" + bid + "/files", "POST", { upload: upload.id });
      toast("File shared with the consultation participants.");
      await refreshMessages(bid);
    });
  }
  await refreshMessages(bid);
  if (!summary && b.status !== "completed") {
    const tick = async () => {
      if (
        !location.pathname.includes("session") &&
        !location.pathname.includes("consultation") &&
        !location.pathname.includes("room")
      )
        return;
      try {
        await refreshMessages(bid);
        const el = $("#session-clock");
        if (el) {
          const left = Math.max(
            0,
            Math.floor((new Date(b.ends) - Date.now()) / 1000),
          );
          el.textContent = nowBefore(b.starts)
            ? "Waiting for your appointment"
            : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} remaining in the scheduled slot`;
        }
      } catch {}
    };
    timer = setInterval(tick, 5000);
    tick();
  }
}
function nowBefore(date) {
  return Date.now() < new Date(date).getTime();
}
async function refreshMessages(bid) {
  try {
    const messages = await api("/bookings/" + bid + "/messages");
    if ($("#messages"))
      $("#messages").innerHTML = messages.length
        ? messages
            .map(
              (m) =>
                `<div class="message"><small>${esc(m.name)} · ${localTime(m.created)}</small>${esc(m.body)}</div>`,
            )
            .join("")
        : "<p>No messages yet. Your conversation will appear here.</p>";
    if ($("#shared-files")) {
      const files = await api("/bookings/" + bid + "/files");
      $("#shared-files").innerHTML = files
        .map(
          (f) =>
            `<p><a class="text-link" href="/api/uploads/${esc(f.data.upload)}" target="_blank" rel="noopener">${esc(f.data.name)} ↗</a></p>`,
        )
        .join("");
    }
    if ($("#connection"))
      $("#connection").textContent = "Connected · refreshes every 5 seconds";
  } catch (e) {
    if ($("#connection"))
      $("#connection").textContent =
        "Connection interrupted. Reconnect to retry.";
    throw e;
  }
}
async function historyPage() {
  if (!requireLogin()) return;
  const list = await recs("report");
  page(
    "Your saved readings",
    "A place to return to the perspectives you want to keep.",
    `<div class="toolbar"><select id="reading-type" aria-label="Filter readings"><option value="">All practices</option><option value="kundli">Astrology</option><option value="tarot">Tarot</option><option value="numerology">Numerology</option><option value="compatibility">Compatibility</option></select></div><div id="reading-list"></div>`,
    true,
  );
  const show = () => {
    const t = $("#reading-type").value,
      rs = list.filter((r) => !t || r.data.type === t);
    $("#reading-list").innerHTML = rs.length
      ? rs.map(reportRow).join("")
      : empty(
          "Space for your discoveries",
          "Save a reading to find it here later.",
          link("/explore-readings", "Explore the practices →", "btn primary"),
        );
  };
  $("#reading-type").onchange = show;
  show();
}
async function favourites() {
  if (!requireLogin()) return;
  const list = await recs("favourite"),
    readers = await api("/readers");
  page(
    "Your favourite readers",
    "Keep a connection you would like to return to.",
    list.length
      ? list
          .map((r) => {
            const reader = readers.find((x) => x.id === r.data.reader);
            return `<div class="row-card"><h3>${esc(reader?.name || "Reader no longer listed")}</h3><div class="actions">${reader ? link("/reader-profile?id=" + reader.id, "View profile →", "btn small") : ""}${btn("Remove", "delete:" + r.id, "small")}</div></div>`;
          })
          .join("")
      : empty(
          "A reader who resonates",
          "Save a reader from their profile to find them here.",
          link("/reader-search", "Explore readers →", "btn"),
        ),
    true,
  );
}
async function account() {
  if (!requireLogin()) return;
  page(
    "Your account",
    "Keep your personal details up to date.",
    `<div class="panel">${form("account", field("name", "Your name", "text", user.name, 'required maxlength="120"') + field("email", "Email address", "email", user.email, "disabled"), "Save changes")}<p>Role: ${esc(user.role)} · Email ${user.verified ? "verified" : "not verified"}</p><div class="actions">${!user.verified ? link("/otp-verification", "Verify email", "btn") : ""}${link("/forgot-password", "Reset password", "btn")}${btn("Sign out", "logout")}</div></div>`,
    true,
  );
  bindForm("account", async (d) => {
    user = (await api("/me", "PATCH", d)).user;
    toast("Account updated.");
    shell();
  });
}
async function notifications() {
  if (!requireLogin()) return;
  const list = await recs("notification");
  page(
    "Notifications",
    "Updates about your account and appointments.",
    list.length
      ? list
          .map(
            (r) =>
              `<div class="row-card"><div><h3>${esc(r.data.title)}</h3><p>${esc(r.data.message)}</p></div>${btn("Dismiss", "delete:" + r.id, "small")}</div>`,
          )
          .join("")
      : empty(
          "You are all caught up",
          "Account and appointment updates will appear here.",
        ),
    true,
  );
}
async function support(ticket = false) {
  if (!requireLogin()) return;
  const list = await recs("ticket"),
    tid = new URLSearchParams(location.search).get("id");
  if (ticket) {
    const r = await api("/records/" + tid);
    page(
      r.data.subject,
      "A private conversation with support.",
      `<div class="panel"><span class="badge">${esc(r.data.status)}</span><p>${esc(r.data.message)}</p>${r.data.replies.map((x) => `<div class="message"><small>${esc(x.author)} · ${localTime(x.created)}</small>${esc(x.body)}</div>`).join("")}${form("reply", area("reply", "Your reply", "", 'required maxlength="5000"') + '<label class="checkbox"><input type="checkbox" name="close">Mark this ticket resolved</label>', "Send reply")}</div>`,
      true,
    );
    bindForm("reply", async (d) => {
      await api("/records/" + tid, "PATCH", {
        reply: d.reply,
        close: d.close === "on",
      });
      render();
    });
    return;
  }
  page(
    "How can we help?",
    "Send a support request and follow the conversation here.",
    `<div class="panel">${form("ticket", field("subject", "Subject", "text", "", 'required maxlength="200"') + area("message", "Tell us what happened", "", 'required maxlength="5000"'), "Create support ticket")}</div><h3>Your requests</h3><br>${list.length ? list.map((r) => `<div class="row-card"><div><h3>${esc(r.data.subject)}</h3><p>${esc(r.data.status)} · ${localTime(r.created)}</p></div>${link("/ticket?id=" + r.id, "Open conversation →", "btn small")}</div>`).join("") : empty("No requests yet", "You can keep track of all your support conversations here.")}`,
    true,
  );
  bindForm("ticket", async (d) => {
    const r = await saveRecord("ticket", d);
    toast("Support request saved.");
    go("/ticket?id=" + r.id);
  });
}
function help() {
  page(
    "A little guidance",
    "Answers to help you find your way.",
    `<div class="panel">${[
      [
        "How do I start a reading?",
        "Choose a practice from Readings. Numerology and tarot can be explored before signing in; save your results after creating an account.",
      ],
      [
        "What if I do not know my birth time?",
        "Select “I do not know the birth time”. The astronomical calculator uses local noon, marks the result as approximate, and does not infer an ascendant.",
      ],
      [
        "How are appointments confirmed?",
        "A chosen time is reserved pending payment. Confirmation follows a verified payment notification from the provider. Checkout requires payment setup.",
      ],
      [
        "Can I cancel or reschedule?",
        "Open Manage appointment. Pending reservations can be cancelled. Future appointments can move to an available slot with the same reader and price. Paid cancellations require a refund review.",
      ],
      [
        "Where do I find saved readings?",
        "Sign in, then open My readings in your account. You can filter by practice, view the report or print it as a PDF.",
      ],
      [
        "How do I become a reader?",
        "Submit an application and credential documents. An administrator reviews the application. Approved readers can set up their profile and publish availability.",
      ],
    ]
      .map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`)
      .join(
        "",
      )}<div class="actions">${link("/support", "Contact support →", "btn primary")}</div></div>`,
  );
}
async function refunds() {
  if (!requireLogin()) return;
  const list = await recs("refund"),
    bookings = (await api("/bookings")).filter(
      (b) => b.customer === user.id && b.status === "confirmed",
    );
  page(
    "Refund requests",
    "Track requests and the outcome of each review.",
    `<div class="panel"><h3>Request a refund</h3><br>${form("refund", select("booking", "Paid appointment", [["", "Select an appointment"], ...bookings.map((b) => [b.id, localTime(b.starts) + " · " + money(b.amount)])], new URLSearchParams(location.search).get("booking")) + area("reason", "Reason for your request", "", 'required maxlength="2000"'), "Submit refund request")}</div>${list.length ? list.map((r) => `<div class="row-card"><div><h3>${money(r.data.amount)}</h3><p>${esc(r.data.reason)}</p>${r.data.review ? `<p>${esc(r.data.review)}</p>` : ""}</div><span class="badge">${esc(r.data.status)}</span></div>`).join("") : empty("No refund requests", "A refund is recorded only after a request and review. No refund is assumed to be complete.")}`,
    true,
  );
  bindForm("refund", async (d) => {
    await saveRecord("refund", d);
    toast("Refund request submitted.");
    render();
  });
}
async function transactions() {
  if (!requireLogin()) return;
  const list = await api("/bookings");
  page(
    "Your transactions",
    "Payment records linked to your appointments.",
    list.length
      ? `<div class="panel table-wrap"><table><thead><tr><th>Appointment</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead><tbody>${list.map((b) => `<tr><td>${localTime(b.starts)}</td><td>${money(b.amount)}</td><td>${esc(b.status)}</td><td>${link("/receipt?id=" + b.id, "View →", "text-link")}</td></tr>`).join("")}</tbody></table></div>`
      : empty(
          "No transactions yet",
          "Confirmed payments and pending reservations will appear here.",
        ),
    true,
  );
}
async function receipt() {
  if (!requireLogin()) return;
  const bid = new URLSearchParams(location.search).get("id");
  if (!bid) {
    go("/transactions");
    return;
  }
  const b = await api("/bookings/" + bid);
  page(
    "Appointment payment record",
    "",
    `<div class="panel"><h2>Flames of Shiva</h2><p>Reference: ${esc(b.id)}</p><p>Appointment: ${localTime(b.starts)}</p><p>Status: ${esc(b.status)}</p><h3>${money(b.amount)}</h3>${b.payment_id ? `<p>Payment provider reference: ${esc(b.payment_id)}</p>` : notice("No captured payment is linked to this booking. This is not a paid receipt.")}<p>This payment record is not a tax invoice.</p>${btn("Print payment record", "print")}</div>`,
    true,
  );
}
async function readerApplication(statusOnly = false) {
  if (!requireLogin()) return;
  const applications = await recs("application"),
    r = applications[0];
  if (statusOnly || r) {
    page(
      "Your reader application",
      "Follow your application from submission to review.",
      r
        ? `<div class="panel"><span class="badge">${esc(r.data.status)}</span><br><br><h2>${esc(r.data.name)}</h2><p>${esc(r.data.experience)}</p>${r.data.review ? notice(esc(r.data.review)) : notice("Your application is awaiting administrator review.")}<div class="actions">${r.data.status === "approved" ? link("/reader-settings", "Set up your reader profile →", "btn primary") : ""}${r.data.status === "changes-requested" ? btn("Submit a revised application", "revise-application", "primary") : ""}</div></div>`
        : empty(
            "No application yet",
            "Share your practice and experience to apply.",
            link(
              "/reader-application",
              "Begin your application →",
              "btn primary",
            ),
          ),
      true,
    );
    return;
  }
  applicationForm();
}
function applicationForm() {
  page(
    "Share your practice",
    "Apply to join Flames of Shiva as a reader.",
    `<div class="grid-2"><div class="panel">${form("application", field("name", "Full name", "text", user.name, 'required maxlength="120"') + field("languages", "Languages", "text", "", 'required placeholder="Hindi, English"') + area("experience", "Your practice and experience", "", 'required maxlength="5000"') + `<label class="field full">Credentials or supporting documents<input type="file" name="credentials" accept="application/pdf,image/png,image/jpeg" multiple required><small>PDF, PNG or JPEG. Up to 5 MB each. Maximum 5 documents.</small></label>`, "Submit application")}</div><div class="panel"><h3>A thoughtful review</h3><p>An administrator reviews your experience and supporting documents before approving your account.</p><p>We may request more information. Follow the application status in your account and submit a revised application when requested.</p>${notice("An application is not a guarantee of approval. Documents stay private to you and reviewing administrators.")}</div></div>`,
    true,
  );
  bindForm("application", async (d, f) => {
    const files = [...f.elements.credentials.files];
    if (files.length > 5) throw Error("Upload up to 5 documents.");
    const credentials = [];
    for (const file of files) credentials.push((await uploadFile(file)).id);
    await saveRecord("application", {
      name: d.name,
      languages: d.languages,
      experience: d.experience,
      credentials,
    });
    toast("Application submitted.");
    go("/application-status");
  });
}
function readerOnly() {
  if (!requireLogin()) return false;
  if (!["reader", "admin"].includes(user.role)) {
    page(
      "Reader workspace",
      "",
      empty(
        "An approved reader account is required",
        "Follow your application status or submit your credentials.",
        link("/reader-application", "Apply as a reader →", "btn primary"),
      ),
      true,
    );
    return false;
  }
  return true;
}
async function readerSettings() {
  if (!readerOnly()) return;
  const existing = (await recs("reader-profile"))[0],
    d = existing?.data || {};
  page(
    "Your reader profile",
    "Introduce your practice in your own words.",
    `<div class="panel">${form("reader-profile", field("name", "Display name", "text", d.name || user.name, 'required maxlength="120"') + field("languages", "Languages, separated by commas", "text", d.languages || "", "required") + field("services", "Practices offered", "text", d.services || "", 'required maxlength="300"') + field("price", "Reference rate in paise", "number", d.price || "", 'required min="0" step="1"') + area("bio", "About your practice", d.bio || "", 'required maxlength="3000"'), "Save public profile")}</div>`,
    true,
  );
  bindForm("reader-profile", async (data) => {
    await saveRecord("reader-profile", data, existing?.id);
    toast("Reader profile saved.");
  });
}
async function availability() {
  if (!readerOnly()) return;
  const list = await api("/slots?reader=" + user.id);
  page(
    "Make time for a conversation",
    `Your timezone: ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}. Times are stored in UTC.`,
    `<div class="panel">${form("availability", field("starts", "Start date and time", "datetime-local", "", "required") + field("ends", "End date and time", "datetime-local", "", "required") + field("price", "Session price in paise", "number", "", 'required min="0" step="1"'), "Publish available time")}</div>${list.length ? list.map((s) => `<div class="row-card"><div><h3>${localTime(s.starts)}</h3><p>${Math.round((new Date(s.ends) - new Date(s.starts)) / 60000)} minutes · ${money(s.price)}</p></div>${btn("Remove time", "remove-slot:" + s.id, "small")}</div>`).join("") : empty("No open times published", "Add a time above. Overlapping slots are rejected by the server.")}`,
    true,
  );
  bindForm("availability", async (d) => {
    const starts = new Date(d.starts),
      ends = new Date(d.ends);
    await api("/slots", "POST", {
      starts: starts.toISOString(),
      ends: ends.toISOString(),
      price: Number(d.price),
    });
    toast("Availability published.");
    render();
  });
}
async function readerDashboard() {
  if (!readerOnly()) return;
  const list = await api("/bookings");
  page(
    "Your reader workspace",
    "A clear view of your upcoming conversations.",
    `<div class="grid-3"><div class="stat"><strong>${list.filter((b) => b.status === "confirmed").length}</strong><p>Confirmed appointments</p></div><div class="stat"><strong>${list.filter((b) => b.status === "completed").length}</strong><p>Completed sessions</p></div><div class="stat"><strong>${list.filter((b) => b.status === "pending").length}</strong><p>Pending payment</p></div></div><div class="actions">${link("/availability", "Manage availability →", "btn primary")}${link("/reader-settings", "Edit your profile", "btn")}${link("/earnings", "Review earnings", "btn")}</div><br>${list.length ? list.map((b) => `<div class="row-card"><div><h3>${localTime(b.starts)}</h3><p>${esc(b.status)} · ${esc(b.format)} · ${esc(b.intake)}</p></div>${link("/live-session?id=" + b.id, "Open workspace →", "btn small")}</div>`).join("") : empty("No consultations yet", "Publish your profile and available times to welcome your first consultation.")}`,
    true,
  );
}
async function readerNotes() {
  if (!readerOnly()) return;
  const [notes, bookings] = await Promise.all([recs("note"), api("/bookings")]);
  page(
    "Your private session notes",
    "Notes are accessible to you and administrators only.",
    `<div class="panel">${form("note", select("booking", "Consultation", [["", "Select a consultation"], ...bookings.map((b) => [b.id, localTime(b.starts)])]) + area("text", "Your notes", "", 'required maxlength="10000"'), "Save private note")}</div>${notes.map((r) => `<div class="panel"><p>${esc(r.data.text)}</p><small>${localTime(r.created)}</small></div>`).join("")}`,
    true,
  );
  bindForm("note", async (d) => {
    await saveRecord("note", d);
    toast("Private note saved.");
    render();
  });
}
async function earnings() {
  if (!readerOnly()) return;
  const [bs, ps] = await Promise.all([api("/bookings"), recs("payout")]);
  const earned = bs
      .filter((b) => b.status === "completed" && b.payment_id)
      .reduce((a, b) => a + b.amount, 0),
    paid = ps.reduce((a, r) => a + r.data.amount, 0);
  page(
    "Your earnings",
    "Only paid, completed sessions contribute to the earnings ledger.",
    `<div class="grid-3"><div class="stat"><strong>${money(earned)}</strong><p>Completed session earnings</p></div><div class="stat"><strong>${money(paid)}</strong><p>Transferred to connected account</p></div><div class="stat"><strong>${money(earned - paid)}</strong><p>Awaiting payout review</p></div></div><br>${notice("The current ledger allocates the full session amount to the reader. Configure an agreed commission policy before accepting production bookings.")}<div class="actions">${link("/payout-details", "Payout account →", "btn")}</div><br>${ps.length ? ps.map((p) => `<div class="row-card"><h3>${money(p.data.amount)}</h3><span>${esc(p.data.providerId)}</span><span class="badge">${esc(p.data.status)}</span></div>`).join("") : empty("No payouts recorded", "Payouts appear only after an administrator submits a real transfer.")}`,
    true,
  );
}
async function payoutDetails() {
  if (!readerOnly()) return;
  const r = (await recs("payout-details"))[0];
  page(
    "Your payout account",
    "Use a verified Stripe Connect account reference.",
    `<div class="panel">${form("payout", field("reference", "Connected account ID", "text", r?.data.reference || "", 'required pattern="acct_[a-zA-Z0-9]+" placeholder="acct_…"'), "Save payout reference")}${notice("Saving a reference does not verify the account or initiate a payout. Connect onboarding must be completed with the payment provider.")}</div>`,
    true,
  );
  bindForm("payout", async (d) => {
    await saveRecord("payout-details", d, r?.id);
    toast("Payout reference saved for review.");
  });
}
async function blog(detail = false) {
  catalog = await api("/catalog");
  const list = catalog.article;
  if (detail) {
    const r = list.find(
      (r) => r.id === new URLSearchParams(location.search).get("id"),
    );
    if (!r) {
      page(
        "The journal",
        "",
        empty(
          "Article not found",
          "Return to the journal to choose a published article.",
          link("/blog", "The journal →", "btn"),
        ),
      );
      return;
    }
    page(
      r.data.title,
      esc(r.data.summary || ""),
      `<article class="article"><p>${esc(r.data.body)}</p></article>`,
    );
    return;
  }
  page(
    "The journal",
    "Ideas and guides for a more thoughtful journey.",
    list.length
      ? `<div class="grid-3">${list.map((r) => `<article class="panel"><span class="badge">${esc(r.data.category || "Reflection")}</span><br><br><h3>${esc(r.data.title)}</h3><p>${esc(r.data.summary)}</p>${link("/article?id=" + r.id, "Read the article →", "text-link")}</article>`).join("")}</div>`
      : empty(
          "A space for thoughtful reading",
          "Published articles will appear here after the editorial team adds them.",
          link("/explore-readings", "Explore a practice →", "btn"),
        ),
  );
}
function cart() {
  try {
    return JSON.parse(localStorage.getItem("flames-cart") || "[]");
  } catch {
    return [];
  }
}
function setCart(c) {
  localStorage.setItem("flames-cart", JSON.stringify(c));
}
async function shop(detail = false) {
  catalog = await api("/catalog");
  const list = catalog.product;
  if (detail) {
    const r = list.find(
      (r) => r.id === new URLSearchParams(location.search).get("id"),
    );
    if (!r) {
      page(
        "The spiritual shop",
        "",
        empty(
          "Product not found",
          "Browse the current collection.",
          link("/shop", "Visit the shop →", "btn"),
        ),
      );
      return;
    }
    page(
      r.data.name,
      "Objects to support your own practice.",
      `<div class="grid-2"><div class="panel"><span class="icon">✧</span><h2>${esc(r.data.name)}</h2><p>${esc(r.data.description)}</p></div><div class="panel"><h2>${money(r.data.price)}</h2><p>${r.data.stock} available</p><label class="field">Quantity<input id="product-qty" type="number" min="1" max="${Math.min(20, r.data.stock)}" value="1"></label><div class="actions">${r.data.stock ? btn("Add to your cart →", "add-cart:" + r.id, "primary") : notice("This product is out of stock.")}${link("/cart", "View cart", "btn")}</div></div></div>`,
    );
    return;
  }
  page(
    "Objects for your practice",
    "Explore the collection at your own pace.",
    `<div class="toolbar"><input id="product-query" placeholder="Search the collection" aria-label="Search products"><select id="product-filter" aria-label="Filter products"><option value="">All categories</option>${[...new Set(list.map((r) => r.data.category || "Spiritual objects"))].map((c) => `<option>${esc(c)}</option>`).join("")}</select>${link("/cart", "Your cart (" + cart().reduce((a, x) => a + x.quantity, 0) + ") →", "btn small")}</div><div id="product-list"></div>`,
  );
  const show = () => {
    const q = $("#product-query").value.toLowerCase(),
      c = $("#product-filter").value,
      rs = list.filter(
        (r) =>
          (r.data.name + " " + r.data.description).toLowerCase().includes(q) &&
          (!c || (r.data.category || "Spiritual objects") === c),
      );
    $("#product-list").innerHTML = rs.length
      ? `<div class="grid-3">${rs.map((r) => `<div class="panel"><span class="badge">${esc(r.data.category || "Spiritual objects")}</span><br><br><h3>${esc(r.data.name)}</h3><p>${esc(r.data.description.slice(0, 140))}</p><p>${money(r.data.price)}</p>${link("/product?id=" + r.id, "Explore this object →", "text-link")}</div>`).join("")}</div>`
      : empty(
          list.length
            ? "No objects match your search"
            : "The collection is being prepared",
          list.length
            ? "Try a different search or category."
            : "Products appear here once real inventory, descriptions and prices are added.",
        );
  };
  $("#product-query").oninput = show;
  $("#product-filter").onchange = show;
  show();
}
async function cartPage() {
  catalog = await api("/catalog");
  const items = cart();
  page(
    "Your cart",
    "A few objects for your own practice.",
    items.length
      ? `<div class="panel">${items
          .map((item) => {
            const r = catalog.product.find((r) => r.id === item.id);
            return `<div class="row-card"><div><h3>${esc(r?.data.name || "Product unavailable")}</h3><p>${r ? money(r.data.price) : ""} · Quantity ${item.quantity}</p></div><div class="actions">${btn("−", "cart-minus:" + item.id, "small")}${btn("+", "cart-plus:" + item.id, "small")}${btn("Remove", "cart-remove:" + item.id, "small")}</div></div>`;
          })
          .join(
            "",
          )}<h3>Total ${money(items.reduce((a, x) => a + (catalog.product.find((r) => r.id === x.id)?.data.price || 0) * x.quantity, 0))}</h3><div class="actions">${link("/checkout", "Continue to checkout →", "btn primary")}${link("/shop", "Keep exploring", "btn")}</div></div>`
      : empty(
          "A little space for something meaningful",
          "Explore the collection and add an object to your cart.",
          link("/shop", "Visit the shop →", "btn primary"),
        ),
  );
}
async function addresses() {
  if (!requireLogin()) return;
  const list = await recs("address");
  page(
    "Your addresses",
    "Keep a delivery address ready for your next order.",
    `<div class="panel">${form("address", field("name", "Recipient name", "text", user.name, 'required maxlength="120"') + field("line", "Street address", "text", "", 'required maxlength="500"') + field("city", "City", "text", "", 'required maxlength="120"') + field("postal", "Postal code", "text", "", 'required maxlength="30"') + field("country", "Country", "text", "", 'required maxlength="120"'), "Save address")}</div>${list.map((r) => `<div class="row-card"><div><h3>${esc(r.data.name)}</h3><p>${esc(r.data.line)}, ${esc(r.data.city)}, ${esc(r.data.postal)}, ${esc(r.data.country)}</p></div>${btn("Remove", "delete:" + r.id, "small")}</div>`).join("")}`,
    true,
  );
  bindForm("address", async (d) => {
    await saveRecord("address", d);
    toast("Address saved.");
    render();
  });
}
async function checkout() {
  if (!requireLogin()) return;
  const addresses = await recs("address");
  if (!cart().length) {
    go("/cart");
    return;
  }
  const key = crypto.randomUUID();
  page(
    "A thoughtful final check",
    "Orders stay pending until payment is confirmed.",
    `<div class="panel">${
      addresses.length
        ? form(
            "order",
            select(
              "address",
              "Delivery address",
              addresses.map((r) => [
                r.id,
                r.data.name + " · " + r.data.line + ", " + r.data.city,
              ]),
            ),
            "Place order and review payment",
          )
        : empty(
            "Add a delivery address first",
            "Save an address in your account, then return to checkout.",
            link("/addresses", "Add an address →", "btn primary"),
          )
    }${notice("Shipping and tax rules need business configuration before production sales. The current order total is the sum of product prices. No additional charge is silently added.")}</div>`,
  );
  bindForm("order", async (d) => {
    const o = await api(
      "/orders",
      "POST",
      { address: d.address, items: cart() },
      { "Idempotency-Key": key },
    );
    setCart([]);
    go("/order?id=" + o.id);
  });
}
async function orders(detail = false) {
  if (!requireLogin()) return;
  if (detail) {
    const oid = new URLSearchParams(location.search).get("id");
    if (!oid) {
      go("/orders");
      return;
    }
    const o = await api("/orders/" + oid);
    page(
      "Your shop order",
      "Confirmation follows a verified payment notification.",
      `<div class="panel"><span class="badge">${esc(o.status)}</span><p>Reference: ${esc(o.id)}</p><h2>${money(o.total)}</h2>${o.lines.map((l) => `<p>${esc(l.name)} × ${l.quantity} · ${money(l.price * l.quantity)}</p>`).join("")}<h3>Delivery address</h3><p>${esc(o.address.name)}<br>${esc(o.address.line)}<br>${esc(o.address.city)}, ${esc(o.address.postal)}<br>${esc(o.address.country)}</p><div class="actions">${o.status === "pending" ? btn("Pay securely ↗", "order-checkout:" + o.id, "primary") + btn("Cancel unpaid order", "order-cancel:" + o.id) : ""}${btn("Print order", "print")}${link("/support", "Need help?", "btn")}</div><div id="payment-result"></div></div>`,
      true,
    );
    return;
  }
  const list = await api("/orders");
  page(
    "Your shop orders",
    "Track your orders from payment to delivery.",
    list.length
      ? list
          .map(
            (o) =>
              `<div class="row-card"><div><h3>${money(o.total)}</h3><p>${localTime(o.created)} · ${esc(o.status)}</p></div>${link("/order?id=" + o.id, "View order →", "btn small")}</div>`,
          )
          .join("")
      : empty(
          "No orders yet",
          "Explore the collection to find something for your practice.",
          link("/shop", "Visit the shop →", "btn"),
        ),
    true,
  );
}
async function horoscope() {
  page(
    "A moment with your stars",
    "Request a daily horoscope from the configured astrology provider.",
    `<div class="panel">${form("horoscope", select("sign", "Your zodiac sign", ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]), "Read my horoscope")}<div id="horoscope-result"></div>${notice("Horoscopes are interpretive content. They are not generated from random scores or presented as factual predictions.")}</div>`,
  );
  bindForm("horoscope", async (d) => {
    const r = await api("/horoscope", "POST", {
      ...d,
      date: new Date().toISOString().slice(0, 10),
    });
    $("#horoscope-result").innerHTML =
      `<pre>${esc(JSON.stringify(r.report, null, 2))}</pre>`;
  });
}
async function adminPage() {
  if (!requireLogin()) return;
  if (user.role !== "admin") {
    page(
      "Administration",
      "",
      empty(
        "Permission denied",
        "This area is restricted to administrator accounts.",
      ),
    );
    return;
  }
  const data = await api("/admin"),
    section = location.pathname.split("/")[2] || "overview";
  const sections = [
    "overview",
    "users",
    "readers",
    "applications",
    "palmistry",
    "bookings",
    "orders",
    "transactions",
    "refunds",
    "payouts",
    "support",
    "content",
    "services",
    "permissions",
    "settings",
    "audit",
  ];
  const adminNav = `<aside class="sidebar"><strong>OPERATIONS</strong>${sections.map((s) => link(s === "overview" ? "/admin" : "/admin/" + s, s[0].toUpperCase() + s.slice(1), s === section ? "active" : "")).join("")}${link("/customer-dashboard", "← Your account")}</aside>`;
  let content = "";
  const records = (kind) => data.records.filter((r) => r.kind === kind);
  const table = (head, rows) =>
    `<div class="panel table-wrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>${rows.length ? "" : notice("No records to review.")}</div>`;
  if (section === "overview")
    content = `<div class="grid-3"><div class="stat"><strong>${data.users.length}</strong><p>Registered accounts</p></div><div class="stat"><strong>${records("application").filter((r) => r.data.status === "submitted").length}</strong><p>Applications awaiting review</p></div><div class="stat"><strong>${data.bookings.length}</strong><p>Consultation reservations</p></div></div><br><div class="panel"><h3>Integration readiness</h3>${Object.entries(
      status,
    )
      .map(([k, v]) => `<p>${esc(k)}: ${esc(String(v))}</p>`)
      .join("")}</div>`;
  if (["users", "readers", "permissions"].includes(section))
    content = table(
      ["Name", "Email", "Role", "Email status", "Action"],
      data.users
        .filter((u) => section !== "readers" || u.role === "reader")
        .map(
          (u) =>
            `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${u.verified ? "Verified" : "Unverified"}</td><td><select aria-label="Role for ${esc(u.name)}" data-role="${u.id}">${["customer", "reader", "admin"].map((role) => `<option ${u.role === role ? "selected" : ""}>${role}</option>`).join("")}</select></td></tr>`,
        ),
    );
  if (section === "applications")
    content =
      records("application")
        .map(
          (r) =>
            `<div class="panel"><span class="badge">${esc(r.data.status)}</span><br><br><h3>${esc(r.data.name)}</h3><p>${esc(r.data.experience)}</p><p>${esc(r.data.languages)}</p><div class="actions">${r.data.credentials.map((c, i) => `<a class="btn small" href="/api/uploads/${esc(c)}" target="_blank" rel="noopener">Credential ${i + 1} ↗</a>`).join("")}</div><br><label class="field">Review notes<textarea id="review-${r.id}"></textarea></label><div class="actions">${btn("Approve", "review:" + r.id + ":approved", "primary")}${btn("Request changes", "review:" + r.id + ":changes-requested")}${btn("Reject", "review:" + r.id + ":rejected")}</div></div>`,
        )
        .join("") ||
      empty("No applications", "New reader applications will appear here.");
  if (["bookings", "transactions"].includes(section))
    content = table(
      ["Reference", "Customer", "Reader", "Start", "Amount", "Status"],
      data.bookings.map(
        (b) =>
          `<tr><td>${esc(b.id.slice(0, 8))}</td><td>${esc(data.users.find((u) => u.id === b.customer)?.name)}</td><td>${esc(data.users.find((u) => u.id === b.reader)?.name)}</td><td>${localTime(b.starts)}</td><td>${money(b.amount)}</td><td>${esc(b.status)}</td></tr>`,
      ),
    );
  if (section === "palmistry")
    content =
      records("palmistry")
        .map(
          (r) =>
            `<div class="panel"><h3>${esc(r.data.question || "Palmistry submission")}</h3><p>Status: ${esc(r.data.status)}</p><label class="field">Assign a reader<select data-assign-palm="${r.id}"><option value="">Choose an approved reader</option>${data.users
              .filter((u) => u.role === "reader")
              .map(
                (u) =>
                  `<option value="${u.id}" ${r.data.reader === u.id ? "selected" : ""}>${esc(u.name)}</option>`,
              )
              .join("")}</select></label></div>`,
        )
        .join("") ||
      empty("No palmistry requests", "Customer submissions will appear here.");
  if (section === "orders")
    content = table(
      ["Order", "Total", "Status", "Next step"],
      data.orders.map(
        (o) =>
          `<tr><td>${esc(o.id.slice(0, 8))}</td><td>${money(o.total)}</td><td>${esc(o.status)}</td><td>${["paid", "processing", "shipped"].includes(o.status) ? btn({ paid: "Start processing", processing: "Mark shipped", shipped: "Mark delivered" }[o.status], "fulfil:" + o.id + ":" + { paid: "processing", processing: "shipped", shipped: "delivered" }[o.status], "small") : ""}</td></tr>`,
      ),
    );
  if (section === "refunds")
    content =
      records("refund")
        .map(
          (r) =>
            `<div class="panel"><span class="badge">${esc(r.data.status)}</span><h3>${money(r.data.amount)}</h3><p>${esc(r.data.reason)}</p><label class="field">Review reason<textarea id="review-${r.id}"></textarea></label><div class="actions">${btn("Submit provider refund", "review:" + r.id + ":approved", "primary")}${btn("Reject request", "review:" + r.id + ":rejected")}</div>${notice("A provider refund request is traceable by its provider ID. Submission does not imply that the funds have settled.")}</div>`,
        )
        .join("") ||
      empty("No refund requests", "Customer refund requests will appear here.");
  if (section === "payouts")
    content = `${notice("Payouts use Stripe Connect transfers. Only completed paid sessions contribute. Configure commission and reversal policies before production use.")}<div class="panel">${form("admin-payout", select("reader", "Reader", [["", "Select a reader"], ...data.users.filter((u) => u.role === "reader").map((u) => [u.id, u.name])]), "Transfer unpaid earnings")}</div>${records(
      "payout",
    )
      .map(
        (r) =>
          `<div class="row-card"><span>${esc(r.data.reader)}</span><strong>${money(r.data.amount)}</strong><span>${esc(r.data.providerId)}</span></div>`,
      )
      .join("")}`;
  if (section === "support")
    content =
      records("ticket")
        .map(
          (r) =>
            `<div class="panel"><span class="badge">${esc(r.data.status)}</span><h3>${esc(r.data.subject)}</h3><p>${esc(r.data.message)}</p>${r.data.replies.map((m) => `<div class="message"><small>${esc(m.author)}</small>${esc(m.body)}</div>`).join("")}<form class="admin-ticket" data-id="${r.id}"><label class="field">Reply<textarea name="reply" required maxlength="5000"></textarea></label><label class="checkbox"><input type="checkbox" name="close"> Resolve ticket</label><br><button class="btn primary" type="submit">Send reply</button><div class="form-result"></div></form></div>`,
        )
        .join("") ||
      empty(
        "No support requests",
        "New requests and their conversations will appear here.",
      );
  if (["content", "services"].includes(section))
    content = `<div class="panel"><h3>${section === "services" ? "Add a service description" : "Publish an article"}</h3><br>${form("admin-content", field("title", "Title", "text", "", 'required maxlength="200"') + field("category", "Category", "text", "", 'required maxlength="120"') + area("summary", "Short introduction", "", 'maxlength="500"') + area("body", "Content", "", 'required maxlength="30000"'), section === "services" ? "Save service" : "Publish article")}</div>${section === "content" ? `<div class="panel"><h3>Add a shop product</h3><br>${form("admin-product", field("name", "Product name", "text", "", 'required maxlength="150"') + field("category", "Category", "text", "", "required") + field("price", "Price in paise", "number", "", 'required min="1" step="1"') + field("stock", "Available quantity", "number", "", 'required min="0" step="1"') + area("description", "Description", "", 'required maxlength="5000"'), "Save product")}</div>` : ""}<h3>Published records</h3><br>${data.records
      .filter((r) => ["article", "product", "service"].includes(r.kind))
      .map(
        (r) =>
          `<div class="row-card"><div><span class="badge">${esc(r.kind)}</span><h3>${esc(r.data.title || r.data.name)}</h3></div><div class="actions">${link((r.kind === "service" ? "/admin/services" : "/admin/content") + "?edit=" + r.id, "Edit", "btn small")}${btn("Remove", "delete:" + r.id, "small")}</div></div>`,
      )
      .join("")}`;
  if (section === "settings")
    content = `<div class="panel"><h3>Platform settings</h3><p>Secrets are configured on the server and are never returned to the browser.</p>${form("platform-settings", field("supportPolicy", "Support response policy", "text", "", 'required maxlength="500"') + area("bookingPolicy", "Booking and cancellation policy", "", 'required maxlength="5000"'), "Save policy draft")}${notice("Policy drafts are stored for review. They are not automatically published as legal terms.")}</div>`;
  if (section === "audit")
    content = table(
      ["Time", "Actor", "Action", "Reference"],
      data.audit.map(
        (r) =>
          `<tr><td>${localTime(r.created)}</td><td>${esc(r.actor || "Provider webhook")}</td><td>${esc(r.action)}</td><td>${esc(r.target)}</td></tr>`,
      ),
    );
  page(
    "Operations workspace",
    "Manage the platform with traceable actions.",
    `<div class="workspace">${adminNav}<div>${content}</div></div>`,
  );
  $$("[data-assign-palm]").forEach(
    (el) =>
      (el.onchange = async () => {
        try {
          await api("/admin/palmistry", "POST", {
            id: el.dataset.assignPalm,
            reader: el.value,
          });
          toast("Submission assigned.");
          render();
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  $$("[data-role]").forEach(
    (el) =>
      (el.onchange = async () => {
        try {
          await api("/admin/role", "POST", {
            id: el.dataset.role,
            role: el.value,
          });
          toast("Role updated and audited.");
        } catch (e) {
          toast(e.message);
          render();
        }
      }),
  );
  const editRecord = data.records.find(
    (r) => r.id === new URLSearchParams(location.search).get("edit"),
  );
  if (
    editRecord &&
    ["article", "product", "service"].includes(editRecord.kind)
  ) {
    const editForm = $(
      "#" + (editRecord.kind === "product" ? "admin-product" : "admin-content"),
    );
    if (editForm) {
      for (const [k, v] of Object.entries(editRecord.data))
        if (editForm.elements[k]) editForm.elements[k].value = v;
      editForm.querySelector("[type=submit]").textContent = "Save changes";
      editForm.scrollIntoView({ block: "center" });
    }
  }
  bindForm("admin-content", async (d) => {
    await saveRecord(
      section === "services" ? "service" : "article",
      d,
      editRecord && editRecord.kind !== "product" ? editRecord.id : undefined,
    );
    toast("Content saved.");
    render();
  });
  bindForm("admin-product", async (d) => {
    await saveRecord(
      "product",
      d,
      editRecord?.kind === "product" ? editRecord.id : undefined,
    );
    toast("Product saved.");
    render();
  });
  bindForm("platform-settings", async (d) => {
    await saveRecord("settings", d);
    toast("Policy draft saved.");
  });
  bindForm("admin-payout", async (d) => {
    await api("/admin/payout", "POST", d);
    toast("Provider transfer recorded.");
    render();
  });
  $$(".admin-ticket").forEach(
    (f) =>
      (f.onsubmit = async (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(f));
        try {
          await api("/records/" + f.dataset.id, "PATCH", {
            reply: d.reply,
            close: d.close === "on",
          });
          render();
        } catch (err) {
          f.querySelector(".form-result").innerHTML = notice(esc(err.message));
        }
      }),
  );
}
async function readerPalms() {
  if (!readerOnly()) return;
  const list = await api("/reader/palmistry");
  page(
    "Your palmistry requests",
    "Private submissions assigned to you.",
    list.length
      ? list
          .map(
            (r) =>
              `<div class="panel"><span class="badge">${esc(r.data.status)}</span><p>${esc(r.data.question)}</p><div class="actions"><a class="btn" href="/api/uploads/${esc(r.data.left)}" target="_blank">Left palm ↗</a><a class="btn" href="/api/uploads/${esc(r.data.right)}" target="_blank">Right palm ↗</a></div><br><form class="deliver-palm" data-id="${r.id}"><label class="field">Your report<textarea name="report" required maxlength="20000">${esc(r.data.report || "")}</textarea></label><br><button type="submit" class="btn primary">Deliver report →</button><div class="form-result"></div></form></div>`,
          )
          .join("")
      : empty(
          "No assigned requests",
          "Assigned palmistry submissions will appear here.",
        ),
    true,
  );
  $$(".deliver-palm").forEach(
    (f) =>
      (f.onsubmit = async (e) => {
        e.preventDefault();
        try {
          await api("/reader/palmistry", "POST", {
            id: f.dataset.id,
            report: new FormData(f).get("report"),
          });
          toast("Report delivered to the customer.");
          render();
        } catch (err) {
          f.querySelector(".form-result").innerHTML = notice(esc(err.message));
        }
      }),
  );
}
const aliases = {
  "/services": "/explore-readings",
  "/about-us": "/about",
  "/create-account": "/sign-up",
  "/reader-search": "/reader-search",
  "/reader-application-status": "/application-status",
  "/join-as-a-reader": "/reader-application",
  "/reader-setup": "/reader-settings",
  "/reader-availability": "/availability",
  "/reader-earnings": "/earnings",
  "/reader-consultation": "/live-session",
  "/reader-requests": "/reader-dashboard",
  "/operations-dashboard": "/admin",
  "/reader-verification": "/admin/applications",
  "/operations-refund-review": "/admin/refunds",
  "/vedic-kundali": "/kundli",
  "/generate-your-kundali": "/birth-details",
  "/generating-your-kundali": "/kundli-overview",
  "/your-vedic-kundali": "/kundli-overview",
  "/kundli-calculation": "/kundli-overview",
  "/rashi-chart": "/kundli-overview",
  "/planetary-positions": "/kundli-overview",
  "/planet-details": "/kundli-overview",
  "/vimshottari-dasha": "/kundli-overview",
  "/dasha-timeline": "/kundli-overview",
  "/important-yogas": "/kundli-overview",
  "/dosha-analysis": "/kundli-overview",
  "/personalized-remedies": "/kundli-overview",
  "/d9-navamsa": "/kundli-overview",
  "/life-predictions": "/kundli-overview",
  "/session-intake": "/booking",
  "/waiting-room": "/live-session",
  "/call-consultation": "/live-session",
  "/session-reconnect": "/live-session",
  "/feedback": "/session-summary",
  "/refund-status": "/refunds",
  "/empty-history": "/my-readings",
  "/help-centre": "/help",
  "/payout-history": "/earnings",
};
async function render() {
  clearInterval(timer);
  timer = null;
  shell();
  $("#main").innerHTML =
    '<div class="loading" role="status">Opening your space…</div>';
  let p = aliases[location.pathname] || location.pathname;
  document.title =
    (p === "/"
      ? "Discover your cosmic blueprint"
      : p.split("/").filter(Boolean).join(" · ").replace(/-/g, " ")) +
    " · Flames of Shiva";
  try {
    if (p === "/") home();
    else if (p === "/about") about();
    else if (p === "/explore-readings") await serviceDirectory();
    else if (p.startsWith("/services/")) {
      const slug = p.split("/")[2];
      const builtIn = services.find((s) => s[0] === slug);
      if (builtIn) go("/" + builtIn[0]);
      else {
        const r = (await api("/catalog")).service.find((r) => r.id === slug);
        if (!r)
          page(
            "Service not found",
            "",
            empty(
              "This service is not listed",
              "Explore the current practices.",
              link("/explore-readings", "View readings →", "btn"),
            ),
          );
        else
          page(
            r.data.title,
            esc(r.data.summary || ""),
            `<article class="article panel"><p>${esc(r.data.body)}</p><div class="actions">${link("/reader-search", "Find a reader →", "btn primary")}</div></article>`,
          );
      }
    } else if (
      [
        "sign-in",
        "sign-up",
        "forgot-password",
        "reset-password",
        "otp-verification",
      ].includes(p.slice(1))
    )
      authPage(p.slice(1));
    else if (p === "/customer-dashboard") await dashboard();
    else if (p === "/account") await account();
    else if (p === "/birth-profiles") await profiles();
    else if (p === "/profile-edit") await profiles(true);
    else if (p === "/my-readings") await historyPage();
    else if (p === "/favourites") await favourites();
    else if (p === "/notifications") await notifications();
    else if (p === "/shared-reading") {
      const r = await api(
        "/shared-report?token=" +
          encodeURIComponent(
            new URLSearchParams(location.search).get("token") || "",
          ),
      );
      report = { ...r.data };
      reportPage(report.type);
      $("#report-feedback").innerHTML = notice(
        "Shared reading. This link expires " + localTime(r.expires) + ".",
      );
    } else if (p === "/kundli") kundliIntro();
    else if (p === "/birth-details") await birthPage();
    else if (p === "/kundli-overview") reportPage("kundli");
    else if (p === "/numerology") numerologyPage();
    else if (p === "/numerology-report") reportPage("numerology");
    else if (p === "/tarot-reading") tarotPage();
    else if (p === "/tarot-spread") tarotPage("spread");
    else if (p === "/tarot-card-selection") tarotPage("selection");
    else if (p === "/tarot-interpretation") reportPage("tarot");
    else if (p === "/compatibility-details") await compatibility();
    else if (p === "/compatibility-report") reportPage("compatibility");
    else if (p === "/palmistry-upload") await palmistry();
    else if (p === "/reader-search") await readers();
    else if (p === "/reader-profile") await readers(true);
    else if (p === "/booking") await bookingPage();
    else if (p === "/payment" || p === "/payment-failed") await paymentPage();
    else if (p === "/booking-confirmation") await paymentPage(true);
    else if (p === "/appointments") await appointments();
    else if (p === "/manage-appointment") await manageAppointment();
    else if (p === "/live-session") await liveSession();
    else if (p === "/session-summary") await liveSession(true);
    else if (p === "/transactions") await transactions();
    else if (p === "/receipt") await receipt();
    else if (p === "/refunds") await refunds();
    else if (p === "/help") help();
    else if (p === "/support") await support();
    else if (p === "/ticket") await support(true);
    else if (p === "/contact")
      page(
        "Let’s find a way forward",
        "For questions about your account, readings or appointments.",
        `<div class="panel"><h2>A conversation starts here.</h2><p>Use a private support ticket to keep your questions and replies in one place. Please avoid sharing unnecessary sensitive information.</p>${link("/support", "Open a support request →", "btn primary")}</div>`,
      );
    else if (p === "/reader-application") await readerApplication();
    else if (p === "/application-status") await readerApplication(true);
    else if (p === "/reader-settings") await readerSettings();
    else if (p === "/reader-dashboard") await readerDashboard();
    else if (p === "/availability") await availability();
    else if (p === "/reader-notes") await readerNotes();
    else if (p === "/reader-palmistry") await readerPalms();
    else if (p === "/earnings") await earnings();
    else if (p === "/payout-details") await payoutDetails();
    else if (p === "/admin" || p.startsWith("/admin/")) await adminPage();
    else if (p === "/blog") await blog();
    else if (p === "/article") await blog(true);
    else if (p === "/shop") await shop();
    else if (p === "/product") await shop(true);
    else if (p === "/cart") await cartPage();
    else if (p === "/checkout") await checkout();
    else if (p === "/addresses") await addresses();
    else if (p === "/orders") await orders();
    else if (p === "/order" || p === "/order-confirmation") await orders(true);
    else if (p === "/daily-horoscope") await horoscope();
    else
      page(
        "A path worth finding",
        "",
        empty(
          "This page could not be found",
          "Return home or explore a reading practice.",
          link("/", "Return home →", "btn primary"),
        ),
      );
  } catch (e) {
    page(
      e.status === 403
        ? "Permission denied"
        : "Something interrupted this step",
      "",
      `${notice(esc(e.message))}<div class="actions">${btn("Try again", "retry", "primary")}${link("/customer-dashboard", "Your account", "btn")}</div>`,
    );
  }
}
document.addEventListener("click", async (e) => {
  const a = e.target.closest?.("a");
  if (
    a &&
    a.origin === location.origin &&
    !a.target &&
    !a.pathname.startsWith("/api/") &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.shiftKey
  ) {
    if (a.hash && a.pathname === location.pathname) return;
    e.preventDefault();
    go(a.pathname + a.search);
    return;
  }
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const [action, ...parts] = b.dataset.action.split(":"),
    arg = parts[0];
  b.disabled = true;
  try {
    if (action === "retry") await render();
    else if (action === "logout") {
      await api("/auth/logout", "POST", {});
      user = null;
      go("/");
    } else if (action === "send-code") {
      const r = await api("/auth/request-code", "POST", { purpose: "verify" });
      sessionStorage.setItem("verifyCodeId", r.codeId);
      toast(r.message);
    } else if (action === "delete") {
      await api("/records/" + arg, "DELETE");
      toast("Record removed.");
      render();
    } else if (action === "save-report") {
      if (!user) {
        toast("Sign in, then return to save this reading.");
        go("/sign-in");
      } else {
        if (report?._savedId) {
          toast("This reading is already saved.");
        } else {
          const r = await saveRecord("report", report);
          report._savedId = r.id;
          toast("Reading saved to your account.");
        }
      }
    } else if (action === "open-report") {
      const r = await api("/records/" + arg);
      report = { ...r.data, _savedId: r.id };
      go(
        "/" +
          {
            numerology: "numerology-report",
            tarot: "tarot-interpretation",
            kundli: "kundli-overview",
            compatibility: "compatibility-report",
          }[report.type],
      );
    } else if (action === "share-report") {
      if (!user) throw Error("Sign in to share a saved reading.");
      if (
        !window.confirm(
          "Create a link that lets anyone with it read this report, including any birth details? It expires in 7 days and can be revoked.",
        )
      )
        return;
      if (!report._savedId) {
        const r = await saveRecord("report", report);
        report._savedId = r.id;
      }
      const shared = await api("/report-shares/" + report._savedId, "POST", {
        consent: true,
      });
      $("#report-feedback").innerHTML =
        notice(
          "Anyone with this link can read this report until " +
            localTime(shared.expires) +
            ".",
        ) +
        `<label class="field">Your reading link<input readonly value="${esc(shared.url)}"></label>`;
      try {
        await navigator.clipboard.writeText(shared.url);
        toast("Reading link copied.");
      } catch {
        toast("Copy the reading link shown below.");
      }
    } else if (action === "revoke-report") {
      if (!report?._savedId)
        throw Error("This reading has no saved sharing links.");
      await api("/report-shares/" + report._savedId, "DELETE");
      $("#report-feedback").innerHTML = notice(
        "All sharing links for this reading have been revoked.",
        true,
      );
    } else if (action === "print") window.print();
    else if (action === "share") {
      const text = report
        ? `A ${report.type} reflection from Flames of Shiva. Explore your own reading at ${location.origin}.`
        : `Explore Flames of Shiva at ${location.origin}.`;
      if (navigator.share)
        await navigator.share({ title: "Flames of Shiva", text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Public summary copied. Private birth details are not included.");
      }
    } else if (action === "spread") {
      tarotState.spread = arg;
      tarotState.positions = [];
      go("/tarot-card-selection");
    } else if (action === "reveal") {
      const count = tarotState.spread === "one" ? 1 : 3;
      if (tarotState.positions.length !== count)
        throw Error(`Select ${count} cards before revealing your reading.`);
      report = await api("/calculate", "POST", {
        type: "tarot",
        ...tarotState,
      });
      go("/tarot-interpretation");
    } else if (action === "favourite") {
      if (!user) {
        go("/sign-in");
      } else {
        const rs = await recs("favourite");
        if (rs.some((r) => r.data.reader === arg))
          toast("This reader is already saved.");
        else {
          await saveRecord("favourite", { reader: arg });
          toast("Reader saved to favourites.");
        }
      }
    } else if (action === "checkout" || action === "order-checkout") {
      const r = await api(
        (action === "checkout" ? "/bookings/" : "/orders/") + arg + "/checkout",
        "POST",
        {},
      );
      const checkout = new URL(r.url);
      if (
        checkout.protocol !== "https:" ||
        checkout.hostname !== "checkout.stripe.com"
      )
        throw Error("Unexpected checkout destination.");
      location.assign(checkout.href);
    } else if (action === "remove-slot") {
      await api("/slots/" + arg, "DELETE");
      toast("Available time removed.");
      render();
    } else if (action === "cancel") {
      await api("/bookings/" + arg + "/cancel", "POST", {});
      toast("Reservation cancelled.");
      render();
    } else if (action === "end-session") {
      if (
        !window.confirm(
          "End this consultation? Both participants will see it as completed.",
        )
      )
        return;
      await api("/bookings/" + arg + "/end", "POST", {});
      go("/session-summary?id=" + arg);
    } else if (action === "reconnect") {
      await refreshMessages(arg);
      toast("Conversation refreshed.");
    } else if (action === "media-options") {
      const r = await api("/bookings/" + arg + "/room", "POST", {});
      $("#media-status").innerHTML =
        notice(
          "Your private call is ready. Camera and microphone permissions are requested by the call provider.",
        ) +
        `<a class="btn primary" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Join private call ↗</a>`;
    } else if (action === "revise-application") applicationForm();
    else if (action === "review") {
      await api("/admin/review", "POST", {
        id: arg,
        status: parts[1],
        review: $("#review-" + arg).value,
      });
      toast("Review saved and audited.");
      render();
    } else if (action === "add-cart") {
      const q = Number($("#product-qty").value),
        product = catalog.product.find((r) => r.id === arg);
      if (!Number.isInteger(q) || q < 1 || q > Math.min(20, product.data.stock))
        throw Error("Choose a valid quantity within available stock.");
      const c = cart(),
        r = c.find((x) => x.id === arg);
      if (r) r.quantity = Math.min(20, product.data.stock, r.quantity + q);
      else c.push({ id: arg, quantity: q });
      setCart(c);
      toast("Added to your cart.");
    } else if (action.startsWith("cart-")) {
      let c = cart(),
        r = c.find((x) => x.id === arg);
      if (action === "cart-remove") c = c.filter((x) => x.id !== arg);
      else if (r) {
        r.quantity =
          action === "cart-plus"
            ? Math.min(20, r.quantity + 1)
            : Math.max(1, r.quantity - 1);
      }
      setCart(c);
      render();
    } else if (action === "order-cancel") {
      await api("/orders/" + arg + "/cancel", "POST", {});
      toast("Unpaid order cancelled. Stock released.");
      render();
    } else if (action === "fulfil") {
      await api("/orders/" + arg + "/fulfil", "POST", { status: parts[1] });
      toast("Order status updated.");
      render();
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    const el =
      $("#reveal-error") || $("#payment-result") || $("#report-feedback");
    if (el)
      el.innerHTML = `<div class="form-error" role="alert">${esc(err.message)}</div>`;
    else toast(err.message);
  } finally {
    b.disabled = false;
  }
});
window.addEventListener("popstate", render);
try {
  const [me, s] = await Promise.all([api("/me"), api("/status")]);
  user = me.user;
  status = s;
} catch {}
render();
