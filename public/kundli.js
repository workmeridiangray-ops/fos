// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Flames of Shiva contributors
import {
  DIVISIONS,
  SIGNS,
  PLANETS,
  escape as e,
  number,
  degrees,
  chartSVG,
  periodEntries,
  activePeriod,
  periodProgress,
  periodInstant,
  strengthLeaves,
} from "./kundli-model.js";
const icon = (name) => {
  const paths = {
    chart: "M3 3h18v18H3z M3 3l18 18M21 3L3 21M12 3l9 9-9 9-9-9z",
    home: "M3 11l9-8 9 8M5 10v11h5v-7h4v7h5V10",
    profiles:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87",
    saved: "M5 3h14v19l-7-4-7 4z",
    sun: "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    moon: "M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10",
    star: "M12 3l2.8 5.7L21 9.6l-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z",
    arrow: "M5 12h14M13 6l6 6-6 6",
    print: "M6 9V3h12v6M6 18H3v-8h18v8h-3M6 14h12v8H6z",
    expand: "M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5",
    back: "M19 12H5M11 6l-6 6 6 6",
    clock: "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    plus: "M12 5v14M5 12h14",
    help: "M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  };
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.chart}"/></svg>`;
};
const link = (href, label, i, active = false) =>
  `<a href="${href}" ${active ? 'aria-current="page"' : ""}>${icon(i)}<span>${label}</span></a>`;
const button = (label, id, cls = "") =>
  `<button type="button" class="k-button ${cls}" data-k="${id}" ${id === "expand" ? 'aria-label="Expand chart"' : ""}>${label}</button>`;
const date = (s) =>
  s
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(s.slice(0, 10) + "T12:00:00Z"))
    : "Unavailable";
const message = (title, copy, extra = "") =>
  `<div class="k-empty"><img src="/assets/kundli-emblem.webp" alt="" width="70" height="70"><h2>${e(title)}</h2><p>${e(copy)}</p>${extra}</div>`;
function planetTable(chart) {
  return `<div class="k-table-wrap" tabindex="0" role="region" aria-label="Planetary positions, scroll horizontally"><table><caption>Positions in ${e(chart.symbol)} · R indicates retrograde</caption><thead><tr>${["Planet", "Sign", "Degree", "House", "Nakshatra", "Pada", "Dignity"].map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${[["Ascendant", chart.ascendant], ...PLANETS.map((n) => [n, chart.planets[n]])].map(([name, p]) => `<tr><th scope="row">${name}${p.retro ? ' <span class="k-retro">R</span>' : ""}</th><td>${e(p.sign)}</td><td class="k-numeric">${degrees(p.pos)}</td><td>${name === "Ascendant" ? 1 : e(p["house-num"])}</td><td>${e(p.nakshatra)}</td><td>${e(p.pada)}</td><td>${e(p["house-rel"] || "—")}</td></tr>`).join("")}</tbody></table></div>`;
}
function houseTable(chart) {
  return `<details class="k-house-summary"><summary>Read the twelve houses</summary><div class="k-table-wrap"><table><thead><tr><th>House</th><th>Sign</th><th>Planets</th></tr></thead><tbody>${chart.houses.map((h) => `<tr><th>${h["house-num"]}</th><td>${e(h.sign)}</td><td>${e([...(h["house-num"] === 1 ? ["Ascendant"] : []), ...h.planets].join(", ") || "None")}</td></tr>`).join("")}</tbody></table></div></details>`;
}
function strengthTable(leaf) {
  const entries = leaf.house
    ? leaf.values.map((v, i) => ["House " + (i + 1), v])
    : Object.entries(leaf.values);
  return `<div class="k-table-wrap"><table><caption>${e(leaf.path.join(" / "))}</caption><thead><tr><th>${leaf.house ? "House" : "Planet"}</th><th>Engine value</th></tr></thead><tbody>${entries.map(([name, v]) => `<tr><th scope="row">${e(name)}</th><td class="k-numeric">${number(v)}</td></tr>`).join("")}</tbody></table></div>`;
}
function strengthPlot(leaf) {
  const entries = leaf.house
    ? leaf.values.map((v, i) => ["House " + (i + 1), v])
    : Object.entries(leaf.values);
  const values = entries.map(([, v]) => v),
    low = Math.min(0, ...values),
    high = Math.max(1, ...values),
    x = (v) => 110 + ((v - low) / (high - low)) * 300;
  return `<svg class="k-strength-plot" viewBox="0 0 480 ${entries.length * 32 + 45}" role="img" aria-label="${e(leaf.path.join(" / "))} values, also shown in the table"><title>${e(leaf.path.join(" / "))}</title><line x1="${x(0)}" x2="${x(0)}" y1="12" y2="${entries.length * 32 + 12}" stroke="#d9ddcf"/>${entries.map(([label, v], i) => `<text x="0" y="${i * 32 + 25}">${e(label)}</text><rect x="${Math.min(x(0), x(v))}" y="${i * 32 + 12}" width="${Math.max(1, Math.abs(x(v) - x(0)))}" height="17" rx="2" fill="${v < 0 ? "#9d715a" : "#a58b57"}"/><text x="425" y="${i * 32 + 25}">${number(v)}</text>`).join("")}<text x="110" y="${entries.length * 32 + 37}">${number(low)}</text><text x="390" y="${entries.length * 32 + 37}">${number(high)}</text></svg>`;
}
function avTable(chart) {
  return `<div class="k-table-wrap" tabindex="0" role="region" aria-label="Ashtakavarga house scores, scroll horizontally"><table><caption>Bhinnashtakavarga and Sarvashtakavarga · columns follow D1 houses</caption><thead><tr><th>Planet</th>${chart.D1.houses.map((h) => `<th scope="col">H${h["house-num"]}<small>${e(h.sign)}</small></th>`).join("")}<th>Sum</th></tr></thead><tbody>${Object.entries(
    chart.AshtakaVarga,
  )
    .map(
      ([name, values]) =>
        `<tr class="${name === "Total" ? "k-total" : ""}"><th scope="row">${name === "Total" ? "Sarvashtakavarga" : e(name)}</th>${values.map((v) => `<td class="k-numeric">${number(v)}</td>`).join("")}<td class="k-numeric">${number(values.reduce((a, b) => a + b, 0))}</td></tr>`,
    )
    .join("")}</tbody></table></div>`;
}
export async function mountKundli(context) {
  const { api, user, status, go, birthFields, bindPlaces, normalBirth, toast } =
    context;
  document.body.classList.add("kundli-mode");
  const main = document.querySelector("#main");
  const mode =
    location.pathname === "/birth-details"
      ? "create"
      : location.pathname === "/kundli-saved"
        ? "saved"
        : "overview";
  const nav = () =>
    link("/customer-dashboard", "Dashboard", "home") +
    link("/kundli", "My kundli", "chart", mode === "overview") +
    link("/kundli-saved", "Saved charts", "saved", mode === "saved") +
    link("/birth-profiles", "Birth profiles", "profiles") +
    link("/reader-search", "Consult a reader", "star");
  main.innerHTML = `<div class="k-shell"><aside class="k-sidebar"><a class="k-brand" href="/"><img src="/assets/kundli-wordmark.webp" alt="Flames of Shiva"></a><nav aria-label="Kundli workspace">${nav()}</nav><div class="k-sidebar-bottom">${link("/help", "Help & support", "help")}<a href="/account"><span class="k-avatar">${e(user.name[0])}</span><span>${e(user.name)}<small>Your account</small></span></a></div></aside><div class="k-main"><header class="k-top"><a href="/kundli" class="k-mobile-brand"><img src="/assets/kundli-wordmark.webp" alt="Flames of Shiva"></a><span class="k-breadcrumb">Your space <span>/</span> Kundli</span><a href="/birth-profiles" class="k-top-profile">${icon("profiles")} Birth profiles</a><a href="/account" class="k-avatar" aria-label="Your account">${e(user.name[0])}</a></header><div id="k-content" class="k-content" aria-live="polite"><div class="k-loading" role="status"><span></span>Opening your chart workspace…</div></div><p class="k-footnote"><a href="/source.html" target="_blank" rel="noopener">Source code · AGPLv3</a></p></div><nav class="k-bottom" aria-label="Mobile workspace">${link("/customer-dashboard", "Home", "home")}${link("/kundli", "Kundli", "chart", mode === "overview")}${link("/kundli-saved", "Saved", "saved", mode === "saved")}${link("/reader-search", "Consult", "profiles")}</nav></div>`;
  const content = main.querySelector("#k-content");
  const current = () => content.isConnected;
  const heading = (title, sub, actions = "") =>
    `<div class="k-heading"><div><h1>${title}</h1><p>${sub}</p></div><div class="k-actions">${actions}</div></div>`;
  function bind(actions) {
    content.querySelectorAll("[data-k]").forEach((b) => {
      b.onclick = async () => {
        const fn = actions[b.dataset.k];
        if (!fn) return;
        b.disabled = true;
        try {
          await fn(b);
        } catch (err) {
          toast(err.message);
        } finally {
          b.disabled = false;
        }
      };
    });
  }
  async function showCreate() {
    const profiles = await api("/records?kind=profile");
    if (!current()) return;
    const selected = new URLSearchParams(location.search).get("profile"),
      profile = profiles.find((p) => p.id === selected);
    content.innerHTML =
      heading(
        "The moment it all began",
        "Use the local birth time recorded at your birthplace.",
      ) +
      `<div class="k-create-grid"><section class="k-card"><h2>Birth details</h2>${profiles.length ? `<label class="field">Use a saved profile<select id="k-profile"><option value="">Enter new details</option>${profiles.map((p) => `<option value="${e(p.id)}" ${p.id === selected ? "selected" : ""}>${e(p.data.name)}</option>`).join("")}</select></label>` : ""}<form id="k-birth" class="k-form"><div class="form-grid">${birthFields("", profile?.data)}</div><label class="checkbox"><input type="checkbox" name="saveProfile" ${profile ? "" : "checked"}> Save these details as a birth profile</label><div class="k-form-result" role="status"></div><div class="k-actions"><button class="k-button k-primary" type="submit">Generate my kundli ${icon("arrow")}</button><button class="k-button" type="button" id="k-save-only">Save profile only</button></div></form></section><aside class="k-create-notes"><h2>A little precision goes a long way.</h2><p>Select your city to resolve its coordinates and timezone. Check both before calculating.</p><p>The timezone is evaluated on your birth date, including historical daylight saving. For an ambiguous clock time, enter the confirmed UTC offset, such as UTC-04:00.</p><h3>Birth time unknown?</h3><p>Save your profile now and add the time later. An accurate ascendant, houses and fine divisions need a known time.</p><h3>Your details stay private</h3><p>Charts are saved to your account. Only create profiles you have permission to use.</p>${!status.kundli ? '<p class="k-alert">The calculation service is awaiting connection. You can save profiles in the meantime.</p>' : ""}</aside></div>`;
    bindPlaces();
    const form = content.querySelector("#k-birth"),
      selector = content.querySelector("#k-profile"),
      result = form.querySelector(".k-form-result");
    if (!profile) form.elements.timezone.value = "";
    form.elements.timezone.placeholder =
      "Choose birthplace or enter its timezone";
    let profileId = profile?.id || null,
      requestKey = crypto.randomUUID();
    selector?.addEventListener("change", () => {
      const p = profiles.find((p) => p.id === selector.value);
      profileId = p?.id || null;
      for (const name of [
        "name",
        "date",
        "time",
        "place",
        "latitude",
        "longitude",
        "timezone",
        "unknownTime",
      ]) {
        const el = form.elements[name];
        if (el.type === "checkbox") el.checked = !!p?.data[name];
        else el.value = p?.data[name] ?? "";
      }
      form.elements.saveProfile.checked = !p;
      bindPlaces();
      requestKey = crypto.randomUUID();
    });
    form.addEventListener("input", () => {
      requestKey = crypto.randomUUID();
    });
    const details = () => normalBirth(Object.fromEntries(new FormData(form)));
    async function saveProfile(input) {
      const r = await api(
        profileId ? "/records/" + profileId : "/records",
        profileId ? "PATCH" : "POST",
        profileId ? input : { kind: "profile", data: input },
      );
      profileId = r.id;
      return r;
    }
    content.querySelector("#k-save-only").onclick = async () => {
      if (!form.reportValidity()) return;
      const b = content.querySelector("#k-save-only");
      b.disabled = true;
      try {
        await saveProfile(details());
        result.innerHTML =
          "<p>Birth profile saved. You can return to it from Birth profiles.</p>";
      } catch (err) {
        result.innerHTML = `<p class="k-error" role="alert">${e(err.message)}</p>`;
      } finally {
        b.disabled = false;
      }
    };
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const input = details();
      if (input.unknownTime) {
        result.innerHTML =
          '<p class="k-error" role="alert">A precise kundli needs a known birth time. Choose Save profile only, or enter the recorded time.</p>';
        return;
      }
      const controls = [...form.querySelectorAll("button")];
      controls.forEach((b) => (b.disabled = true));
      result.innerHTML =
        '<div class="k-loading" role="status"><span></span>Calculating your sixteen charts and life periods. This can take up to a minute…</div>';
      try {
        if (form.elements.saveProfile.checked) await saveProfile(input);
        const r = await api("/kundli/runs", "POST", {
          input,
          profileId,
          requestKey,
        });
        if (current()) go("/kundli-overview?id=" + r.id);
      } catch (err) {
        if (current())
          result.innerHTML = `<p class="k-error" role="alert">${e(err.message)}</p><p>Your details are still here. Check them and try again.</p>${err.status === 401 ? '<a class="k-button" href="/sign-in?next=%2Fbirth-details">Sign in again</a>' : ""}`;
      } finally {
        controls.forEach((b) => (b.disabled = false));
      }
    };
  }
  async function showSaved() {
    const rows = await api("/kundli/runs");
    if (!current()) return;
    content.innerHTML =
      heading(
        "Your saved charts",
        "Return to a moment. Explore it with a fresh perspective.",
        `<a class="k-button k-primary" href="/birth-details">${icon("plus")} Create kundli</a>`,
      ) +
      `<section class="k-card">${rows.length ? `<label class="k-search">Find a chart<input id="k-search" type="search" placeholder="Search name or birthplace"></label><div id="k-saved-list"></div>` : message("Your first chart starts here", "Create a kundli from your birth details. It will be saved here automatically.", '<a class="k-button k-primary" href="/birth-details">Create your kundli</a>')}</section>`;
    const show = (q) => {
      const filtered = rows.filter((r) =>
        (r.input.name + " " + r.input.place).toLowerCase().includes(q),
      );
      content.querySelector("#k-saved-list").innerHTML = filtered.length
        ? filtered
            .map(
              (r) =>
                `<article class="k-saved-row"><div><h2>${e(r.input.name)}</h2><p>${date(r.input.date)} · ${e(r.input.time)} · ${e(r.input.place)}</p><small>${e(r.state === "ready" ? "Saved chart" : r.state === "pending" ? "Calculation in progress" : "Calculation needs attention")} · ${date(r.created)}</small></div><div class="k-actions"><a class="k-button" href="/kundli-overview?id=${e(r.id)}">Open chart ${icon("arrow")}</a>${button("Delete", "delete-" + r.id)}</div></article>`,
            )
            .join("")
        : "<p>No charts match. Try another name or birthplace.</p>";
      const actions = {};
      for (const r of filtered)
        actions["delete-" + r.id] = async () => {
          if (
            !confirm("Delete this saved chart? Your birth profile will remain.")
          )
            return;
          await api("/kundli/runs/" + r.id, "DELETE");
          toast("Chart deleted.");
          await showSaved();
        };
      bind(actions);
    };
    if (rows.length) {
      show("");
      content.querySelector("#k-search").oninput = (ev) =>
        show(ev.target.value.toLowerCase());
    }
  }
  async function showOverview() {
    const id = new URLSearchParams(location.search).get("id");
    let row;
    if (id) row = await api("/kundli/runs/" + encodeURIComponent(id));
    else {
      const rows = await api("/kundli/runs");
      const latest = rows.find((r) => r.state === "ready");
      if (latest) row = await api("/kundli/runs/" + latest.id);
    }
    if (!current()) return;
    if (!row) {
      content.innerHTML =
        heading(
          "Your cosmic overview",
          "A thoughtful view of the sky at your birth.",
          `<a class="k-button" href="/kundli-saved">Saved charts</a>`,
        ) +
        message(
          "Your sky, ready to explore",
          "Start with a birth profile to generate your own chart, planetary positions and life periods.",
          '<a class="k-button k-primary" href="/birth-details">Create your kundli ' +
            icon("arrow") +
            "</a>",
        );
      return;
    }
    if (row.state !== "ready") {
      content.innerHTML =
        heading(
          row.state === "pending"
            ? "Your chart is taking shape"
            : "Let’s try that calculation again",
          e(row.input.name),
        ) +
        message(
          row.state === "pending"
            ? "Calculation in progress"
            : "Your details have been retained",
          row.error ||
            "The engine is calculating your chart. Reopen it shortly.",
          button("Check status", "check") +
            '<a class="k-button" href="/birth-details' +
            (row.profile_id ? "?profile=" + e(row.profile_id) : "") +
            '">Review birth details</a>',
        );
      bind({ check: showOverview });
      return;
    }
    const data = row.chart;
    let division = "D1",
      style = "north",
      tab = "overview",
      path = [],
      fine = {},
      strength = "Shadbala",
      leafIndex = 0;
    const leaves = strengthLeaves(data.Balas);
    const titleText = () => e(row.input.name);
    function chartCard(expanded = false) {
      const chart = data[division];
      return `<section class="k-card k-chart-card"><div class="k-card-heading"><h2>${e(DIVISIONS[division])} <span>${division}</span></h2>${expanded ? "" : button(icon("expand") + '<span class="k-hide-small">Expand</span>', "expand", "k-quiet")}</div><div class="k-chart-tools"><div class="k-segment" aria-label="Common divisions">${["D1", "D9", "D10"].map((d) => `<button data-k="division-${d}" aria-pressed="${division === d}">${d}</button>`).join("")}</div><label class="k-sr">All sixteen divisions<select id="k-division${expanded ? "-dialog" : ""}">${Object.entries(
        DIVISIONS,
      )
        .map(
          ([d, n]) =>
            `<option value="${d}" ${division === d ? "selected" : ""}>${d} · ${n}</option>`,
        )
        .join(
          "",
        )}</select></label><label class="k-sr">Chart style<select id="k-style${expanded ? "-dialog" : ""}"><option value="north" ${style === "north" ? "selected" : ""}>North Indian</option><option value="south" ${style === "south" ? "selected" : ""}>South Indian</option></select></label></div>${expanded ? '<p class="k-help">Scroll the enlarged chart in either direction to read every placement.</p><div class="k-chart-viewport" tabindex="0" role="region" aria-label="Enlarged chart, scroll horizontally and vertically">' : ""}${chartSVG(chart, style, DIVISIONS[division])}${expanded ? "</div>" : ""}<p class="k-chart-caption">${style === "north" ? "Fixed houses · numbers indicate signs (1 = Aries)" : "Fixed signs · Asc marks the ascendant"} · R = retrograde</p><div class="k-chart-legend">${PLANETS.map((n) => `<span>${e(data.D1.planets[n].symbol)} ${n}</span>`).join("")}</div>${houseTable(chart)}</section>`;
    }
    function dashaSummary() {
      const entries = periodEntries(data),
        active = activePeriod(data, entries);
      if (!active) return "<p>No major period covers today in this report.</p>";
      const [key, p] = active;
      const child = activePeriod(data, periodEntries(data, [key]));
      return `<h2>Current dasha</h2><h3>${e(p.lord)} <span>Mahadasha</span></h3><p>${date(p.startDate)} — ${date(p.endDate)}</p><progress max="100" value="${periodProgress(data, p)}" aria-label="Elapsed major period"></progress>${child ? `<p>${e(child[1].lord)} Antardasha <small>until ${date(child[1].endDate)}</small></p>` : ""}${button("Explore your life periods " + icon("arrow"), "tab-dashas", "k-quiet")}`;
    }
    function overview() {
      return `<div class="k-overview-grid">${chartCard()}<aside class="k-overview-aside"><div class="k-summary-grid">${[
        [
          "sun",
          "Ascendant",
          data.D1.ascendant.sign,
          data.D1.ascendant["lagna-lord"] + " ruled",
        ],
        [
          "moon",
          "Moon sign",
          data.D1.planets.Moon.sign,
          data.D1.planets.Moon.rashi,
        ],
        [
          "star",
          "Birth nakshatra",
          data.D1.planets.Moon.nakshatra,
          "Pada " + data.D1.planets.Moon.pada,
        ],
      ]
        .map(
          ([i, label, value, sub]) =>
            `<section class="k-card k-summary">${icon(i)}<span class="k-meta">${label}</span><h2>${e(value)}</h2><p>${e(sub)}</p></section>`,
        )
        .join(
          "",
        )}</div><section class="k-card k-dasha-summary">${dashaSummary()}</section><section class="k-card k-explore"><h2>A closer look at your chart</h2><p>Explore the placements, periods and strengths behind your overview.</p><div>${[
        ["planets", "Planetary positions"],
        ["dashas", "Life periods"],
        ["strengths", "Strengths & Balas"],
        ["ashtakavarga", "Ashtakavarga"],
      ]
        .map(([id, label]) =>
          button(label + icon("arrow"), "tab-" + id, "k-explore-link"),
        )
        .join(
          "",
        )}</div></section><div class="k-consult"><img src="/assets/kundli-emblem.webp" alt="" width="46" height="46"><div><h2>Bring your questions.</h2><p>Explore your chart with a reader.</p></div><a class="k-button" href="/reader-search">Consult ${icon("arrow")}</a></div></aside></div><section class="k-card k-positions"><div class="k-card-heading"><h2>Planetary positions</h2><span>${division} · Sidereal Lahiri</span></div>${planetTable(data[division])}</section>`;
    }
    function dashas() {
      const entries = periodEntries(data, path, fine),
        active = activePeriod(data, entries);
      return `<section class="k-card"><div class="k-card-heading"><div><h2>${["Mahadasha", "Antardasha", "Pratyantardasha", "Sookshma"][path.length]} periods</h2><p>Vimshottari · dates use the fixed offset at birth (${e(row.input.timezone)}).</p></div>${path.length ? button(icon("back") + " Back one level", "dasha-back") : ""}</div><nav class="k-dasha-breadcrumb" aria-label="Dasha levels">${button("All major periods", "dasha-root", "k-quiet")}${path.map((p, i) => button(e(p), "dasha-level-" + i, "k-quiet")).join("<span>/</span>")}</nav><p class="k-help">Select a period to explore its subperiods. “Current” is calculated from today’s date. The first available subperiod may begin partway through its parent at birth.</p><div class="k-periods">${entries.length ? entries.map(([key, p]) => `<button type="button" class="k-period ${active?.[0] === key ? "k-period-active" : ""}" data-k="period-${key}" ${path.length === 3 ? "disabled" : ""}><span class="k-period-name">${e(p.lord)} ${active?.[0] === key ? '<span class="k-status">Current</span>' : ""}</span><span>${date(p.startDate)}${path.length >= 2 ? " · " + e(p.startDate.slice(11, 19)) : ""}<small>to ${date(p.endDate)}${path.length >= 2 ? " · " + e(p.endDate.slice(11, 19)) : ""}</small></span><span class="k-period-duration">${number((periodInstant(p.endDate, data.calculation_settings.utc_offset_hours) - periodInstant(p.startDate, data.calculation_settings.utc_offset_hours)) / 86400000)} days${path.length < 3 ? icon("arrow") : ""}</span><progress max="100" value="${periodProgress(data, p)}" aria-label="Elapsed ${e(p.lord)} period"></progress></button>`).join("") : "<p>No periods were returned for this branch.</p>"}</div></section>`;
    }
    function strengths() {
      const options = leaves.filter((l) => l.path[0] === strength);
      const leaf = options[Math.min(leafIndex, options.length - 1)];
      return `<section class="k-card"><div class="k-card-heading"><div><h2>Strengths & Balas</h2><p>Values calculated by the supplied engine. Units vary by metric; these are not prediction scores.</p></div></div><div class="k-chart-tools"><label>Strength system<select id="k-strength">${Object.keys(
        data.Balas,
      )
        .map((k) => `<option ${k === strength ? "selected" : ""}>${k}</option>`)
        .join(
          "",
        )}</select></label><label>Metric<select id="k-metric">${options.map((l, i) => `<option value="${i}" ${i === leafIndex ? "selected" : ""}>${e(l.path.slice(1).join(" / ") || l.path[0])}</option>`).join("")}</select></label></div>${leaf ? strengthPlot(leaf) + strengthTable(leaf) : "<p>No values supplied.</p>"}</section>`;
    }
    function assumptions() {
      return `<section class="k-card"><h2>Calculation details</h2><dl class="k-settings">${Object.entries(
        data.calculation_settings,
      )
        .filter(([k]) => !["fine_period_path", "include_sookshma"].includes(k))
        .map(
          ([k, v]) =>
            `<div><dt>${e(k.replaceAll("_", " "))}</dt><dd>${e(v)}</dd></div>`,
        )
        .join(
          "",
        )}</dl><p>Divisional topics are traditional labels, not personal predictions. Fine divisions are sensitive to birth-time accuracy. No interpretive reading has been invented.</p></section>`;
    }
    function printReport() {
      return `<article class="k-print-report"><img src="/assets/kundli-wordmark.webp" alt="Flames of Shiva" width="190"><h1>Kundli · ${titleText()}</h1><p>${date(row.input.date)} · ${e(row.input.time)} · ${e(row.input.place)} · ${e(row.input.timezone)}</p><p>Coordinates ${e(row.input.latitude)}, ${e(row.input.longitude)} · UTC ${e(data.calculation_settings.utc)} · Saved ${date(row.created)}</p>${Object.entries(
        DIVISIONS,
      )
        .map(
          ([d, n]) =>
            `<section class="k-print-division"><h2>${d} · ${n}</h2>${chartSVG(data[d], style, n)}${planetTable(data[d])}</section>`,
        )
        .join(
          "",
        )}<section><h2>Vimshottari periods</h2><p>Fixed UTC offset at birth: ${data.calculation_settings.utc_offset_hours} hours. All available major, antar and pratyantar periods follow. Fine periods reflect branches opened in this workspace.</p>${[
        "mahadashas",
        "antardashas",
        "paryantardashas",
        "sookshmadashas",
      ]
        .map(
          (level, i) =>
            `<h3>${["Mahadashas", "Antardashas", "Pratyantardashas", "Opened Sookshma branch"][i]}</h3><table><thead><tr><th>Period</th><th>Start</th><th>End</th></tr></thead><tbody>${Object.entries(
              i === 3 ? fine : data.Dashas.Vimshottari[level] || {},
            )
              .map(
                ([key, p]) =>
                  `<tr><th>${e(key)}</th><td>${e(p.startDate)}</td><td>${e(p.endDate)}</td></tr>`,
              )
              .join("")}</tbody></table>`,
        )
        .join(
          "",
        )}</section><section><h2>Strengths & Balas</h2>${leaves.map(strengthTable).join("")}</section><section><h2>Ashtakavarga</h2>${avTable(data)}</section>${assumptions()}</article>`;
    }
    function paint() {
      if (!current()) return;
      content.innerHTML =
        heading(
          "Your cosmic overview",
          "Your birth chart. A starting point for deeper understanding.",
          button(icon("print") + " Print / Save PDF", "print") +
            '<a class="k-button k-primary" href="/birth-details">' +
            icon("plus") +
            " New chart</a>",
        ) +
        `<div class="k-birth-strip"><div class="k-birth-avatar">${icon("profiles")}</div><div><strong>${titleText()}</strong><p>${date(row.input.date)} <span>·</span> ${e(row.input.time)} <span>·</span> ${e(row.input.place)}</p></div><span class="k-birth-zone">${e(row.input.timezone)}<small>Sidereal · Lahiri</small></span><span class="k-saved-label">${icon("saved")} Saved privately</span>${row.profile_id ? `<a href="/profile-edit?id=${e(row.profile_id)}">Edit profile</a>` : ""}</div><nav class="k-tabs" aria-label="Chart sections">${[
          ["overview", "Overview"],
          ["planets", "Planets"],
          ["dashas", "Dashas"],
          ["strengths", "Strengths"],
          ["ashtakavarga", "Ashtakavarga"],
          ["details", "Calculation details"],
        ]
          .map(
            ([id, label]) =>
              `<button data-k="tab-${id}" aria-current="${tab === id ? "page" : "false"}">${label}</button>`,
          )
          .join(
            "",
          )}</nav><div class="k-tab-body">${tab === "overview" ? overview() : tab === "planets" ? `<section class="k-card"><div class="k-card-heading"><h2>Planetary positions · ${division}</h2></div>${chartCard()}${planetTable(data[division])}</section>` : tab === "dashas" ? dashas() : tab === "strengths" ? strengths() : tab === "ashtakavarga" ? `<section class="k-card"><h2>Ashtakavarga</h2><p>Individual planetary contributions and their total. These arrays follow the engine’s D1 house order, starting with ${e(data.D1.ascendant.sign)}.</p>${avTable(data)}</section>` : assumptions()}</div><p class="k-footnote">Calculated from your birth details · ${e(data.calculation_settings.ayanamsa)} · ${e(data.calculation_settings.ephemeris)}</p><div id="k-print-slot"></div><dialog class="k-chart-dialog" aria-label="Expanded divisional chart"><div class="k-dialog-head"><h2>Explore your chart</h2>${button("Close", "close-dialog")}</div><div id="k-dialog-content"></div></dialog>`;
      const actions = {
        print: () => {
          content.querySelector("#k-print-slot").innerHTML = printReport();
          window.print();
        },
        expand: () => {
          const dialog = content.querySelector("dialog");
          dialog.querySelector("#k-dialog-content").innerHTML = chartCard(true);
          dialog.showModal();
          wireChart(dialog, true);
          dialog.querySelectorAll('[data-k^="division-"]').forEach(
            (b) =>
              (b.onclick = () => {
                division = b.dataset.k.slice(9);
                dialog.querySelector("#k-dialog-content").innerHTML =
                  chartCard(true);
                wireDialog();
              }),
          );
        },
        "close-dialog": () => {
          content.querySelector("dialog").close();
          paint();
        },
        "dasha-root": () => {
          path = [];
          paint();
        },
        "dasha-back": () => {
          path.pop();
          paint();
        },
      };
      for (const id of [
        "overview",
        "planets",
        "dashas",
        "strengths",
        "ashtakavarga",
        "details",
      ])
        actions["tab-" + id] = () => {
          tab = id;
          paint();
        };
      for (const d of Object.keys(DIVISIONS))
        actions["division-" + d] = () => {
          division = d;
          paint();
        };
      path.forEach((_, i) => {
        actions["dasha-level-" + i] = () => {
          path = path.slice(0, i + 1);
          paint();
        };
      });
      if (tab === "dashas")
        for (const [key] of periodEntries(data, path, fine))
          actions["period-" + key] = async (b) => {
            const next = key.split("-");
            if (next.length === 3) {
              b.insertAdjacentHTML(
                "beforeend",
                '<span role="status">Loading fine periods…</span>',
              );
              try {
                fine = await api(
                  "/kundli/runs/" +
                    row.id +
                    "/dashas?path=" +
                    encodeURIComponent(key),
                );
              } catch (err) {
                b.lastElementChild.remove();
                throw err;
              }
            }
            path = next;
            paint();
          };
      bind(actions);
      content
        .querySelector("dialog")
        .addEventListener("cancel", () => queueMicrotask(paint));
      wireChart(content);
      const system = content.querySelector("#k-strength"),
        metric = content.querySelector("#k-metric");
      if (system)
        system.onchange = () => {
          strength = system.value;
          leafIndex = 0;
          paint();
        };
      if (metric)
        metric.onchange = () => {
          leafIndex = Number(metric.value);
          paint();
        };
    }
    function wireDialog() {
      const dialog = content.querySelector("dialog");
      wireChart(dialog, true);
      dialog.querySelectorAll('[data-k^="division-"]').forEach(
        (b) =>
          (b.onclick = () => {
            division = b.dataset.k.slice(9);
            dialog.querySelector("#k-dialog-content").innerHTML =
              chartCard(true);
            wireDialog();
          }),
      );
    }
    function wireChart(root, expanded = false) {
      for (const [id, fn] of [
        ["division", (v) => (division = v)],
        ["style", (v) => (style = v)],
      ]) {
        const el = root.querySelector("#k-" + id + (expanded ? "-dialog" : ""));
        if (el)
          el.onchange = () => {
            fn(el.value);
            if (expanded) {
              content.querySelector("#k-dialog-content").innerHTML =
                chartCard(true);
              wireDialog();
            } else paint();
          };
      }
    }
    paint();
  }
  try {
    if (mode === "create") await showCreate();
    else if (mode === "saved") await showSaved();
    else await showOverview();
  } catch (err) {
    if (current())
      content.innerHTML =
        heading("Your kundli workspace", "") +
        message(
          err.status === 401
            ? "Sign in to reopen your charts"
            : "We couldn’t open this page",
          err.message,
          err.status === 401
            ? `<a class="k-button k-primary" href="/sign-in?next=${encodeURIComponent(location.pathname + location.search)}">Sign in again</a>`
            : button("Try again", "reload") +
                '<a class="k-button" href="/kundli">My kundli</a>',
        );
    bind({ reload: () => go(location.pathname + location.search) });
  }
}
