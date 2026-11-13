// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Flames of Shiva contributors
export const DIVISIONS = {
  D1: "Birth chart",
  D2: "Wealth",
  D3: "Siblings",
  D4: "Home & property",
  D7: "Children",
  D9: "Navamsha",
  D10: "Career",
  D12: "Parents",
  D16: "Comforts",
  D20: "Spiritual practice",
  D24: "Learning",
  D27: "Strengths",
  D30: "Challenges",
  D40: "Maternal heritage",
  D45: "Paternal heritage",
  D60: "Shashtiamsha",
};
export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];
export const PLANETS = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
];
export const escape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const number = (v) =>
  Number.isFinite(v)
    ? new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(v)
    : "Unavailable";
export const degrees = (p) =>
  p ? `${p.deg}° ${p.min}′ ${p.sec}″` : "Unavailable";
const short = {
  Sun: "Su",
  Moon: "Mo",
  Mars: "Ma",
  Mercury: "Me",
  Jupiter: "Ju",
  Venus: "Ve",
  Saturn: "Sa",
  Rahu: "Ra",
  Ketu: "Ke",
  Ascendant: "Asc",
};
export function houseBodies(chart, h) {
  return [...(h["house-num"] === 1 ? ["Ascendant"] : []), ...h.planets].map(
    (name) => ({
      name,
      label: short[name] + (chart.planets[name]?.retro ? " R" : ""),
      planet: chart.planets[name],
    }),
  );
}
export function chartSVG(chart, style = "north", label = "Birth chart") {
  const title = escape(
    `${label}, ${style === "south" ? "South Indian fixed-sign" : "North Indian fixed-house"} layout`,
  );
  const houses = chart.houses;
  let lines = "",
    text = "";
  if (style === "north") {
    lines =
      '<rect x="10" y="10" width="580" height="580" rx="2"/><path d="M10 10L590 590M590 10L10 590M300 10L590 300L300 590L10 300Z"/>';
    const anchors = [
      [300, 115],
      [150, 48],
      [52, 128],
      [150, 265],
      [52, 428],
      [150, 515],
      [300, 415],
      [450, 515],
      [548, 428],
      [450, 265],
      [548, 128],
      [450, 48],
    ];
    houses.forEach((h, i) => {
      const [x, y] = anchors[i],
        b = houseBodies(chart, h);
      const topTriangle = i === 1 || i === 11,
        bottomTriangle = i === 5 || i === 7;
      const upperSide = i === 2 || i === 10,
        lowerSide = i === 4 || i === 8;
      const packed =
        b.length > 3 &&
        (topTriangle || bottomTriangle || upperSide || lowerSide);
      const signY =
        topTriangle && packed
          ? 29
          : bottomTriangle
            ? 497
            : packed && upperSide
              ? 105
              : packed && lowerSide
                ? 405
                : y;
      text += `<text class="k-sign" x="${x}" y="${signY}">${h["sign-num"]}</text>`;
      const cols = b.length > 5 ? 2 : 1;
      b.forEach((p, j) => {
        const px = x + (cols === 2 ? (j % 2 ? 19 : -19) : 0),
          startY =
            topTriangle && packed
              ? 50
              : bottomTriangle
                ? 522
                : packed && upperSide
                  ? 130
                  : packed && lowerSide
                    ? 430
                    : y + 25,
          py = startY + Math.floor(j / cols) * (packed ? 15 : 19);
        text += `<text class="${p.name === "Ascendant" ? "k-asc" : "k-planet"}${packed ? " k-packed" : ""}" x="${px}" y="${py}">${escape(p.label)}</text>`;
      });
    });
  } else {
    const cells = [
      [1, 0],
      [2, 0],
      [3, 0],
      [3, 1],
      [3, 2],
      [3, 3],
      [2, 3],
      [1, 3],
      [0, 3],
      [0, 2],
      [0, 1],
      [0, 0],
    ];
    for (let s = 0; s < 12; s++) {
      const [cx, cy] = cells[s],
        x = 10 + cx * 145,
        y = 10 + cy * 145,
        h = houses.find((h) => h["sign-num"] === s + 1);
      lines += `<rect x="${x}" y="${y}" width="145" height="145"/>`;
      text += `<text class="k-sign" x="${x + 72.5}" y="${y + 25}">${SIGNS[s]}</text>`;
      const b = houseBodies(chart, h),
        cols = b.length > 5 ? 2 : 1;
      b.forEach((p, j) => {
        text += `<text class="${p.name === "Ascendant" ? "k-asc" : "k-planet"}" x="${x + 72.5 + (cols === 2 ? (j % 2 ? 24 : -24) : 0)}" y="${y + 50 + Math.floor(j / cols) * 19}">${escape(p.label)}</text>`;
      });
    }
    text += `<text class="k-center" x="300" y="290">${escape(chart.symbol || "")}</text><text class="k-sign" x="300" y="320">${escape(chart.ascendant.sign)} ascendant</text>`;
  }
  return `<svg class="k-chart" viewBox="0 0 600 600" role="img" aria-label="${title}" xmlns="http://www.w3.org/2000/svg"><title>${title}</title><g class="k-chart-lines">${lines}</g><g text-anchor="middle">${text}</g></svg>`;
}
export function periodInstant(date, offset) {
  const value = Date.parse(
    date.replace(" ", "T").replace(/(\.\d{3})\d+$/, "$1") + "Z",
  );
  return value - Number(offset) * 3600000;
}
export function periodEntries(chart, path = [], fine = {}) {
  const level = [
    "mahadashas",
    "antardashas",
    "paryantardashas",
    "sookshmadashas",
  ][path.length];
  const source =
    path.length === 3 ? fine : chart.Dashas.Vimshottari[level] || {};
  return Object.entries(source)
    .filter(
      ([k]) =>
        k.split("-").length === path.length + 1 &&
        (!path.length || k.startsWith(path.join("-") + "-")),
    )
    .sort(
      (a, b) =>
        periodInstant(
          a[1].startDate,
          chart.calculation_settings.utc_offset_hours,
        ) -
        periodInstant(
          b[1].startDate,
          chart.calculation_settings.utc_offset_hours,
        ),
    );
}
export function activePeriod(chart, entries, now = Date.now()) {
  const offset = chart.calculation_settings.utc_offset_hours;
  return entries.find(
    ([, p]) =>
      periodInstant(p.startDate, offset) <= now &&
      periodInstant(p.endDate, offset) > now,
  );
}
export function periodProgress(chart, p, now = Date.now()) {
  const offset = chart.calculation_settings.utc_offset_hours,
    start = periodInstant(p.startDate, offset),
    end = periodInstant(p.endDate, offset);
  return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
}
export function strengthLeaves(value, path = []) {
  if (Array.isArray(value)) return [{ path, values: value, house: true }];
  if (!value || typeof value !== "object") return [];
  if (Object.values(value).every((v) => typeof v === "number"))
    return [{ path, values: value, house: false }];
  return Object.entries(value).flatMap(([k, v]) =>
    strengthLeaves(v, [...path, k]),
  );
}
