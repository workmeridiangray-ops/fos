// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Flames of Shiva contributors
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chartBirth, validateChart, divisions } from "../src/chart-provider.js";
import {
  chartSVG,
  periodInstant,
  periodEntries,
  activePeriod,
  strengthLeaves,
  SIGNS,
} from "../public/kundli-model.js";
const input = {
  name: "Integration test",
  date: "1990-05-12",
  time: "10:30",
  timezone: "Asia/Kolkata",
  place: "Mumbai",
  latitude: 19.076,
  longitude: 72.8777,
};
function syntheticResponse() {
  const chart = {};
  for (const d of divisions) {
    chart[d] = {
      symbol: d,
      ascendant: { sign: "Gemini" },
      houses: Array.from({ length: 12 }, (_, i) => ({
        "house-num": i + 1,
        "sign-num": ((i + 2) % 12) + 1,
        sign: SIGNS[(i + 2) % 12],
        planets:
          i === 0
            ? [
                "Sun",
                "Moon",
                "Mars",
                "Mercury",
                "Jupiter",
                "Venus",
                "Saturn",
                "Rahu",
                "Ketu",
              ]
            : [],
      })),
      planets: Object.fromEntries(
        [
          "Sun",
          "Moon",
          "Mars",
          "Mercury",
          "Jupiter",
          "Venus",
          "Saturn",
          "Rahu",
          "Ketu",
        ].map((p) => [
          p,
          { sign: "Gemini", pos: { dec_deg: 12 }, "house-num": 1 },
        ]),
      ),
    };
  }
  return {
    ...chart,
    Balas: {},
    AshtakaVarga: Object.fromEntries(
      [
        "Sun",
        "Moon",
        "Mars",
        "Mercury",
        "Jupiter",
        "Venus",
        "Saturn",
        "Total",
      ].map((p) => [p, Array(12).fill(0)]),
    ),
    Dashas: {
      Vimshottari: { paryantardashas: { "Sun-Moon-Mars": { lord: "Mars" } } },
    },
    calculation_settings: { utc_offset_hours: 5.5 },
  };
}
test("historical birth mapping rejects invented precision and DST ambiguity", () => {
  assert.equal(chartBirth(input).timezone, 5.5);
  assert.equal(
    chartBirth({ ...input, date: "2000-01-01", timezone: "Asia/Kathmandu" })
      .timezone,
    5.75,
  );
  assert.throws(
    () => chartBirth({ ...input, unknownTime: true }),
    /known birth time/,
  );
  assert.throws(
    () =>
      chartBirth({
        ...input,
        timezone: "America/New_York",
        date: "2020-03-08",
        time: "02:30",
      }),
    /nonexistent/,
  );
  assert.throws(
    () =>
      chartBirth({
        ...input,
        timezone: "America/New_York",
        date: "2020-11-01",
        time: "01:30",
      }),
    /ambiguous/,
  );
  assert.throws(() => chartBirth({ ...input, latitude: "" }), /coordinates/);
});
test("SVG layouts retain actual house and sign mapping", () => {
  const d = syntheticResponse();
  assert.equal(validateChart(d), d);
  const north = chartSVG(d.D1, "north"),
    south = chartSVG(d.D1, "south");
  assert.match(north, /North Indian fixed-house/);
  assert.match(south, /South Indian fixed-sign/);
  assert.match(south, /Gemini ascendant/);
  assert.match(north, /Asc/);
  assert.match(south, /Su/);
  d.D9.houses.pop();
  assert.throws(() => validateChart(d), /invalid chart/);
});
test("dasha dates use birth offset and current status is derived", () => {
  assert.equal(
    periodInstant("2000-01-01 10:30:00.123456", 5.5),
    Date.parse("2000-01-01T05:00:00.123Z"),
  );
  const chart = {
    calculation_settings: { utc_offset_hours: 0 },
    Dashas: {
      Vimshottari: {
        mahadashas: {
          Sun: {
            startDate: "1990-01-01 00:00:00",
            endDate: "1996-01-01 00:00:00",
          },
          Moon: {
            startDate: "1996-01-01 00:00:00",
            endDate: "2006-01-01 00:00:00",
          },
        },
      },
    },
  };
  assert.equal(
    activePeriod(chart, periodEntries(chart), Date.parse("2000-01-01"))[0],
    "Moon",
  );
  assert.equal(
    strengthLeaves({
      BhavaBala: { Total: [1, 2] },
      Shadbala: { Total: { Sun: 3 } },
    }).length,
    2,
  );
});
test("saved runs enforce account ownership, idempotency, failures and private fine cache", async () => {
  let calls = 0,
    upstreamMode = "ok";
  const provider = http.createServer(async (req, res) => {
    let text = "";
    for await (const c of req) text += c;
    const b = JSON.parse(text);
    calls++;
    assert.equal(req.headers["x-api-key"], "test-secret");
    if (upstreamMode === "failure") {
      res.writeHead(500);
      res.end("{}");
      return;
    }
    const result = syntheticResponse();
    if (b.dasha_path)
      result.Dashas.Vimshottari.sookshmadashas = {
        "Sun-Moon-Mars-Rahu": { lord: "Rahu" },
      };
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  });
  await new Promise((r) => provider.listen(0, "127.0.0.1", r));
  const dir = mkdtempSync(join(tmpdir(), "fos-kundli-"));
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATA_DIR: dir,
    CHART_API_URL: `http://127.0.0.1:${provider.address().port}`,
    CHART_API_KEY: "test-secret",
  });
  delete process.env.RESEND_API_KEY;
  const { server } = await import("../src/server.js");
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.APP_ORIGIN = base;
  async function req(path, method = "GET", data, cookie = "") {
    const r = await fetch(base + "/api" + path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function account(name) {
    await req("/auth/signup", "POST", {
      email: name + "@example.test",
      name,
      password: "integration-test-password",
    });
    return (
      await req("/auth/login", "POST", {
        email: name + "@example.test",
        password: "integration-test-password",
      })
    ).cookie;
  }
  try {
    const a = await account("kundli-a"),
      b = await account("kundli-b");
    assert.equal((await req("/kundli/runs")).status, 401);
    const data = { input, requestKey: "test-request-001" };
    const saved = await req("/kundli/runs", "POST", data, a);
    assert.equal(saved.status, 201, JSON.stringify(saved.data));
    assert.equal(calls, 1);
    const id = saved.data.id;
    assert.equal(
      (await req("/kundli/runs/" + id, "GET", undefined, b)).status,
      404,
    );
    assert.equal(
      (await req("/kundli/runs/" + id, "DELETE", undefined, b)).status,
      404,
    );
    assert.equal(
      (await req("/kundli/runs", "GET", undefined, b)).data.length,
      0,
    );
    assert.equal((await req("/kundli/runs", "POST", data, a)).data.id, id);
    assert.equal(calls, 1);
    assert.equal(
      (
        await req(
          "/kundli/runs",
          "POST",
          { ...data, input: { ...input, time: "11:30" } },
          a,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await req(
          "/kundli/runs/" + id + "/dashas?path=Sun-Moon-Mars",
          "GET",
          undefined,
          b,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await req(
          "/kundli/runs/" + id + "/dashas?path=Sun-Moon-Mars",
          "GET",
          undefined,
          a,
        )
      ).status,
      200,
    );
    assert.equal(calls, 2);
    await req(
      "/kundli/runs/" + id + "/dashas?path=Sun-Moon-Mars",
      "GET",
      undefined,
      a,
    );
    assert.equal(calls, 2);
    assert.equal(
      (await req("/kundli/runs/" + id, "GET", undefined, a)).data.chart.D1
        .symbol,
      "D1",
    );
    upstreamMode = "failure";
    assert.equal(
      (
        await req(
          "/kundli/runs",
          "POST",
          { input, requestKey: "test-request-fail" },
          a,
        )
      ).status,
      502,
    );
    assert.equal(
      (await req("/kundli/runs", "GET", undefined, a)).data[0].state,
      "error",
    );
    upstreamMode = "ok";
    assert.equal(
      (
        await req(
          "/kundli/runs",
          "POST",
          { input, requestKey: "test-request-fail" },
          a,
        )
      ).status,
      201,
    );
    await req("/kundli/runs/" + id, "DELETE", undefined, a);
    assert.equal(
      (await req("/kundli/runs/" + id, "GET", undefined, a)).status,
      404,
    );
  } finally {
    await new Promise((r) => server.close(r));
    await new Promise((r) => provider.close(r));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dense chart groups stay inside the diagram in both layouts", () => {
  const names = [
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
  for (let house = 1; house <= 12; house++) {
    const chart = syntheticResponse().D1;
    for (const h of chart.houses)
      h.planets = h["house-num"] === house ? names : [];
    for (const style of ["north", "south"]) {
      const svg = chartSVG(chart, style);
      const labels = [
        ...svg.matchAll(
          /class="k-(?:planet|asc)(?: k-packed)?" x="([\d.]+)" y="([\d.]+)"/g,
        ),
      ];
      assert.equal(labels.length, 10);
      for (const [, x, y] of labels) {
        assert.ok(Number(x) > 10 && Number(x) < 590);
        assert.ok(Number(y) > 25 && Number(y) < 590);
      }
    }
  }
});

test("supplied Sagittarius spelling is normalized without changing sign numbers", () => {
  const data = syntheticResponse();
  for (const chart of divisions.map((d) => data[d]))
    for (const h of chart.houses)
      if (h["sign-num"] === 9) h.sign = "Saggitarius";
  validateChart(data);
  assert.equal(
    data.D1.houses.find((h) => h["sign-num"] === 9).sign,
    "Sagittarius",
  );
});
