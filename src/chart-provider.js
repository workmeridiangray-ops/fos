// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Flames of Shiva contributors
import { birthInstant, signs } from "./calculations.js";
export const divisions = [
  "D1",
  "D2",
  "D3",
  "D4",
  "D7",
  "D9",
  "D10",
  "D12",
  "D16",
  "D20",
  "D24",
  "D27",
  "D30",
  "D40",
  "D45",
  "D60",
];
const planets = [
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
const error = (message, status = 400) =>
  Object.assign(new Error(message), { status });
export function chartBirth(input) {
  if (!input || typeof input !== "object")
    throw error("Enter your birth details.");
  if (input.unknownTime)
    throw error(
      "A precise kundli needs a known birth time. You can save this profile and add the time later.",
    );
  const dt = birthInstant(input);
  const latitude = Number(input.latitude),
    longitude = Number(input.longitude);
  if (
    input.latitude === "" ||
    input.longitude === "" ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  )
    throw error("Choose a birthplace or enter valid coordinates.");
  if (dt.year < 1600 || dt.year > 2100)
    throw error("The chart engine supports births from 1600 through 2100.");
  for (const [field, max] of [
    ["name", 120],
    ["place", 300],
    ["timezone", 100],
  ])
    if (
      typeof input[field] !== "string" ||
      !input[field].trim() ||
      input[field].length > max
    )
      throw error(`Enter a valid ${field}.`);
  return {
    name: input.name.trim(),
    gender: ["male", "female", "other"].includes(input.gender)
      ? input.gender
      : "other",
    year: dt.year,
    month: dt.month,
    day: dt.day,
    hour: dt.hour,
    minute: dt.minute,
    second: 0,
    place: input.place.trim(),
    latitude,
    longitude,
    timezone: dt.offset / 60,
    timezone_name: input.timezone,
    include_sookshma: false,
  };
}
export function validateChart(data) {
  if (
    !data ||
    typeof data !== "object" ||
    !data.calculation_settings ||
    !data.Dashas?.Vimshottari ||
    !data.Balas ||
    !data.AshtakaVarga
  )
    throw error(
      "The chart service returned incomplete data. Please retry.",
      502,
    );
  for (const key of divisions) {
    const chart = data[key];
    if (
      !chart?.ascendant?.sign ||
      !Array.isArray(chart.houses) ||
      chart.houses.length !== 12 ||
      !planets.every(
        (p) =>
          chart.planets?.[p]?.sign &&
          Number.isFinite(chart.planets[p].pos?.dec_deg),
      )
    )
      throw error(
        "The chart service returned an invalid chart. Please retry.",
        502,
      );
    // Supplied engine spells Sagittarius "Saggitarius". Normalize labels only.
    const canonical = (value) =>
      value === "Saggitarius" ? "Sagittarius" : value;
    chart.ascendant.sign = canonical(chart.ascendant.sign);
    for (const p of planets)
      chart.planets[p].sign = canonical(chart.planets[p].sign);
    for (const h of chart.houses) if (h) h.sign = canonical(h.sign);
    if (
      !chart.houses.every(
        (h, i) =>
          h &&
          h["house-num"] === i + 1 &&
          Number.isInteger(h["sign-num"]) &&
          h["sign-num"] >= 1 &&
          h["sign-num"] <= 12 &&
          h.sign === signs[h["sign-num"] - 1] &&
          Array.isArray(h.planets) &&
          h.planets.every((p) => planets.includes(p)),
      )
    )
      throw error("The chart service returned invalid house mapping.", 502);
    const listed = chart.houses.flatMap((h) => h.planets);
    if (
      new Set(listed).size !== 9 ||
      listed.length !== 9 ||
      new Set(chart.houses.map((h) => h["sign-num"])).size !== 12 ||
      chart.houses[0].sign !== chart.ascendant.sign ||
      !planets.every(
        (p) =>
          chart.planets[p]["house-num"] ===
          chart.houses.find((h) => h.planets.includes(p))["house-num"],
      )
    )
      throw error(
        "The chart service returned inconsistent planetary placements.",
        502,
      );
  }
  if (
    !Number.isFinite(data.calculation_settings.utc_offset_hours) ||
    Math.abs(data.calculation_settings.utc_offset_hours) > 14 ||
    ![...planets.slice(0, 7), "Total"].every(
      (p) =>
        Array.isArray(data.AshtakaVarga[p]) &&
        data.AshtakaVarga[p].length === 12 &&
        data.AshtakaVarga[p].every(Number.isFinite),
    )
  )
    throw error(
      "The chart service returned invalid calculation metadata or house scores.",
      502,
    );
  if (JSON.stringify(data).length > 1_000_000)
    throw error("The chart report exceeds the storage limit.", 502);
  return data;
}
export async function fetchChart(env, birth, path = null) {
  if (!env.CHART_API_URL || !env.CHART_API_KEY)
    throw error(
      "The chart service is being connected. Your birth profiles remain available; retry chart generation after setup is complete.",
      503,
    );
  const url = new URL(env.CHART_API_URL);
  if (
    url.protocol !== "https:" &&
    !(
      env.NODE_ENV !== "production" &&
      ["127.0.0.1", "localhost"].includes(url.hostname)
    )
  )
    throw error("The chart service requires a secure HTTPS URL.", 503);
  url.pathname = url.pathname.replace(/\/$/, "") + "/chart";
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.CHART_API_KEY,
      },
      body: JSON.stringify({
        ...birth,
        include_sookshma: !!path,
        ...(path ? { dasha_path: path } : {}),
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch {
    throw error(
      "The chart service did not respond in time. Please retry.",
      504,
    );
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw error(
      response.status === 429
        ? "The chart service is busy. Please retry shortly."
        : "The chart service could not complete this calculation. Please verify the details or retry later.",
      response.status === 429 ? 429 : 502,
    );
  }
  const reader = response.body.getReader();
  let length = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 1_000_000) {
        await reader.cancel();
        throw error("The chart response exceeds its limit.", 502);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw error("The chart service returned unreadable data.", 502);
  }
  return validateChart(data);
}
