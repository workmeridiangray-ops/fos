// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Flames of Shiva contributors
import { randomUUID } from "node:crypto";
import { chartBirth, fetchChart } from "./chart-provider.js";
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const decode = (r) => ({
  ...r,
  input: JSON.parse(r.input),
  chart: r.chart ? JSON.parse(r.chart) : null,
});
export async function kundliRoutes(c) {
  const {
    path,
    method,
    url,
    u,
    requireUser,
    body,
    req,
    reply,
    one,
    all,
    run,
    rate,
    env,
  } = c;
  if (!path.startsWith("/api/kundli/runs")) return false;
  requireUser();
  const base = "/api/kundli/runs";
  if (path === base && method === "GET")
    return reply(
      (
        await all(
          "SELECT id,profile_id,input,state,error,created,updated FROM kundli_runs WHERE owner=? ORDER BY created DESC LIMIT 100",
          u.id,
        )
      ).map((r) => ({ ...r, input: JSON.parse(r.input) })),
    );
  if (path === base && method === "POST") {
    const d = await body(req),
      birth = chartBirth(d.input);
    if (
      typeof d.requestKey !== "string" ||
      !/^[a-zA-Z0-9-]{8,80}$/.test(d.requestKey)
    )
      fail("A calculation request ID is required.");
    const input = {
      name: birth.name,
      date: d.input.date,
      time: d.input.time,
      place: birth.place,
      timezone: birth.timezone_name,
      latitude: birth.latitude,
      longitude: birth.longitude,
      gender: birth.gender,
      unknownTime: false,
    };
    if (
      d.profileId &&
      !(await one(
        "SELECT id FROM records WHERE id=? AND kind='profile' AND owner=?",
        d.profileId,
        u.id,
      ))
    )
      fail("Birth profile not found.", 404);
    let row = await one(
      "SELECT * FROM kundli_runs WHERE owner=? AND request_key=?",
      u.id,
      d.requestKey,
    );
    if (row && JSON.stringify(input) !== row.input)
      fail(
        "This request ID belongs to different birth details. Start a new calculation.",
        409,
      );
    if (row?.state === "ready") return reply(decode(row));
    if (
      row?.state === "pending" &&
      Date.now() - Date.parse(row.updated) < 70000
    )
      return reply(decode(row), 202);
    await rate(u.id + ":kundli", 5);
    const stamp = new Date().toISOString();
    if (!row) {
      const id = randomUUID();
      const claim = await run(
        "INSERT OR IGNORE INTO kundli_runs(id,owner,request_key,profile_id,input,state,created,updated) VALUES(?,?,?,?,?,'pending',?,?)",
        id,
        u.id,
        d.requestKey,
        d.profileId || null,
        JSON.stringify(input),
        stamp,
        stamp,
      );
      row = await one(
        "SELECT * FROM kundli_runs WHERE owner=? AND request_key=?",
        u.id,
        d.requestKey,
      );
      if (!claim.changes) return reply(decode(row), 202);
    } else {
      const claim = await run(
        "UPDATE kundli_runs SET state='pending',error=NULL,updated=? WHERE id=? AND owner=? AND updated=?",
        stamp,
        row.id,
        u.id,
        row.updated,
      );
      if (!claim.changes)
        return reply(
          decode(
            await one(
              "SELECT * FROM kundli_runs WHERE id=? AND owner=?",
              row.id,
              u.id,
            ),
          ),
          202,
        );
    }
    try {
      const chart = await fetchChart(env, birth);
      await run(
        "UPDATE kundli_runs SET state='ready',chart=?,error=NULL,updated=? WHERE id=? AND owner=? AND state='pending'",
        JSON.stringify(chart),
        new Date().toISOString(),
        row.id,
        u.id,
      );
    } catch (e) {
      await run(
        "UPDATE kundli_runs SET state='error',error=?,updated=? WHERE id=? AND owner=?",
        e.message,
        new Date().toISOString(),
        row.id,
        u.id,
      );
      throw e;
    }
    const saved = await one(
      "SELECT * FROM kundli_runs WHERE id=? AND owner=?",
      row.id,
      u.id,
    );
    if (!saved) fail("This chart was deleted during calculation.", 410);
    return reply(decode(saved), 201);
  }
  const match = path.match(/^\/api\/kundli\/runs\/([a-zA-Z0-9-]+)(\/dashas)?$/);
  if (!match) fail("Chart endpoint not found.", 404);
  const row = await one(
    "SELECT * FROM kundli_runs WHERE id=? AND owner=?",
    match[1],
    u.id,
  );
  if (!row) fail("Chart not found.", 404);
  if (!match[2]) {
    if (method === "GET") return reply(decode(row));
    if (method === "DELETE") {
      await run("DELETE FROM kundli_runs WHERE id=? AND owner=?", row.id, u.id);
      return reply({ ok: true });
    }
  } else if (method === "GET") {
    if (row.state !== "ready")
      fail("Generate this chart before opening its periods.", 409);
    const pathKey = url.searchParams.get("path") || "",
      parts = pathKey.split("-");
    const chart = JSON.parse(row.chart);
    if (
      parts.length !== 3 ||
      !chart.Dashas.Vimshottari.paryantardashas[pathKey]
    )
      fail("Choose a valid three-level dasha period.");
    const cached = await one(
      "SELECT periods FROM kundli_dasha_cache WHERE run_id=? AND path=?",
      row.id,
      pathKey,
    );
    if (cached) return reply(JSON.parse(cached.periods));
    await rate(u.id + ":kundli-fine", 5);
    const fine = await fetchChart(
      env,
      chartBirth(JSON.parse(row.input)),
      parts,
    );
    const periods = fine.Dashas.Vimshottari.sookshmadashas;
    if (
      !periods ||
      !Object.keys(periods).length ||
      Object.keys(periods).some((k) => !k.startsWith(pathKey + "-"))
    )
      fail("Fine periods are unavailable for this branch.", 502);
    // Owner check after the external request also protects deletion races.
    if (
      !(await one(
        "SELECT id FROM kundli_runs WHERE id=? AND owner=?",
        row.id,
        u.id,
      ))
    )
      fail("Chart not found.", 404);
    await run(
      "INSERT OR IGNORE INTO kundli_dasha_cache(run_id,path,periods) VALUES(?,?,?)",
      row.id,
      pathKey,
      JSON.stringify(periods),
    );
    return reply(periods);
  }
  fail("Method not allowed.", 405);
}
