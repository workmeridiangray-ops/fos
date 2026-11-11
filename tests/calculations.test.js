import test from "node:test";
import assert from "node:assert/strict";
import {
  kundli,
  numerology,
  tarot,
  birthInstant,
  reduceNumber,
} from "../src/calculations.js";
import { verifyWebhook } from "../src/integrations.js";
import { createHmac } from "node:crypto";
test("Pythagorean rules preserve master numbers and explicit letter sums", () => {
  assert.equal(reduceNumber(29), 11);
  const r = numerology({ name: "ABC", date: "1990-01-01" });
  assert.equal(r.numbers.find((x) => x.key === "expression").number, 6);
  assert.equal(r.numbers.find((x) => x.key === "lifePath").number, 3);
  assert.throws(() => numerology({ name: "", date: "1990-01-01" }));
});
test("birth timezone conversion, invalid dates, DST gaps and ambiguous times", () => {
  assert.equal(
    birthInstant({
      date: "2000-01-01",
      time: "12:00",
      timezone: "Asia/Kolkata",
    }).toUTC().hour,
    6,
  );
  for (const p of [
    { date: "2000-02-30", time: "12:00", timezone: "UTC" },
    { date: "2024-03-10", time: "02:30", timezone: "America/New_York" },
    { date: "2024-11-03", time: "01:30", timezone: "America/New_York" },
  ])
    assert.throws(() => birthInstant(p));
});
test("astronomical results are finite, consistent and labelled tropical", () => {
  const r = kundli({
    name: "Test",
    date: "2000-01-01",
    time: "12:00",
    timezone: "UTC",
    latitude: 0,
    longitude: 0,
  });
  assert.equal(r.planets.length, 7);
  assert.equal(r.planets[0].sign, "Capricorn");
  assert.ok(r.planets.every((p) => p.longitude >= 0 && p.longitude < 360));
  assert.match(r.assumptions.zodiac, /Tropical/);
  assert.equal(r.assumptions.ayanamsa.startsWith("None"), true);
});
test("tarot requires unique positions and returns distinct actual cards", () => {
  const r = tarot({
    question: "What can I reflect on?",
    spread: "three",
    positions: [0, 3, 7],
  });
  assert.equal(new Set(r.cards.map((c) => c.name)).size, 3);
  assert.throws(() =>
    tarot({ question: "Q", spread: "three", positions: [0, 0, 0] }),
  );
  assert.throws(() => tarot({ question: "Q", spread: "one", positions: [99] }));
});
test("webhook signature checks raw payload, tolerance and multiple signatures", () => {
  const raw = JSON.stringify({ id: "evt_test" }),
    t = Math.floor(Date.now() / 1000),
    secret = "test-secret",
    sig = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  assert.equal(
    verifyWebhook(raw, `t=${t},v1=bad,v1=${sig}`, secret).id,
    "evt_test",
  );
  assert.throws(() => verifyWebhook(raw + " ", `t=${t},v1=${sig}`, secret));
  assert.throws(() => verifyWebhook(raw, `t=${t - 1000},v1=${sig}`, secret));
});
