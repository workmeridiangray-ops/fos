// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Flames of Shiva contributors
import * as Astronomy from "astronomy-engine";
import { DateTime } from "luxon";
import { randomInt } from "node:crypto";
export const signs = [
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
export function birthInstant(input) {
  const { date, time, timezone, unknownTime } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || ""))
    throw Error("Enter a valid birth date.");
  if (!unknownTime && !/^\d{2}:\d{2}$/.test(time || ""))
    throw Error("Enter the birth time or select unknown time.");
  const local = `${date}T${unknownTime ? "12:00" : time}`;
  const dt = DateTime.fromISO(local, { zone: timezone });
  if (!dt.isValid || dt.toFormat("yyyy-MM-dd'T'HH:mm") !== local)
    throw Error("Invalid date, timezone, or nonexistent local time.");
  if (dt.getPossibleOffsets().length > 1)
    throw Error(
      "This birth time is ambiguous at a daylight saving transition. Enter an explicit UTC offset as the timezone.",
    );
  if (dt.toMillis() > Date.now())
    throw Error("Birth date cannot be in the future.");
  return dt;
}
export function kundli(input) {
  const dt = birthInstant(input),
    date = dt.toJSDate();
  const latitude = Number(input.latitude),
    longitude = Number(input.longitude);
  if (
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  )
    throw Error("Valid latitude and longitude are required.");
  const planets = [
    "Sun",
    "Moon",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
  ].map((body) => {
    const tropical = Astronomy.Ecliptic(
      Astronomy.GeoVector(body, date, true),
    ).elon;
    return {
      body,
      longitude: Math.round(tropical * 10000) / 10000,
      sign: signs[Math.floor(tropical / 30)],
      degree: Math.round((tropical % 30) * 100) / 100,
    };
  });
  return {
    type: "kundli",
    name: input.name,
    input,
    planets,
    assumptions: {
      engine: "Astronomy Engine",
      utc: dt.toUTC().toISO(),
      timezone: input.timezone,
      coordinates: { latitude, longitude },
      zodiac: "Tropical geocentric ecliptic of date",
      ayanamsa:
        "None. Sidereal Lahiri calculation requires the configured Vedic provider.",
      chartConvention:
        "Planetary positions only; no inferred houses or ascendant.",
      unknownTime: !!input.unknownTime,
      timeAssumption: input.unknownTime
        ? "Local noon; Moon position is approximate."
        : "Provided local birth time",
    },
    unavailable: [
      "Sidereal Rashi and D9 charts",
      "Rahu and Ketu",
      "Vimshottari dashas and subperiods",
      "Yogas, doshas and remedies",
      "Life predictions",
    ],
    notice:
      "These are astronomical tropical positions, not a complete Vedic kundli. The Vedic provider must be configured for sidereal charts and interpretive reports.",
  };
}
export function reduceNumber(n) {
  while (n > 9 && ![11, 22, 33].includes(n))
    n = String(n)
      .split("")
      .reduce((a, x) => a + Number(x), 0);
  return n;
}
const meanings = {
  1: "Initiative and independence",
  2: "Cooperation and sensitivity",
  3: "Expression and creativity",
  4: "Structure and consistency",
  5: "Change and curiosity",
  6: "Care and responsibility",
  7: "Reflection and inquiry",
  8: "Organisation and ambition",
  9: "Compassion and perspective",
  11: "Intuition and inspiration",
  22: "Practical vision and building",
  33: "Compassionate teaching and service",
};
export function numerology({ name, date }) {
  if (typeof name !== "string" || !name.trim() || name.length > 120)
    throw Error("Enter your full name (up to 120 characters).");
  birthInstant({ date, unknownTime: true, timezone: "UTC" });
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  if (!letters)
    throw Error(
      "Use a Latin-letter transliteration for this Pythagorean method.",
    );
  const value = (s) =>
    [...s].reduce((a, c) => a + ((c.charCodeAt(0) - 65) % 9) + 1, 0);
  const nums = {
    lifePath: reduceNumber(
      [...date.replace(/-/g, "")].reduce((a, c) => a + Number(c), 0),
    ),
    expression: reduceNumber(value(letters)),
    soulUrge: reduceNumber(value(letters.replace(/[^AEIOU]/g, ""))),
    personality: reduceNumber(value(letters.replace(/[AEIOU]/g, ""))),
    birthday: reduceNumber(Number(date.slice(-2))),
  };
  return {
    type: "numerology",
    name,
    date,
    numbers: Object.entries(nums).map(([key, number]) => ({
      key,
      number,
      meaning: meanings[number] || "No matching letters for this number.",
    })),
    method:
      "Pythagorean A=1 through I=9, repeating J=1. Life path sums all date digits. Repeated digit reduction preserves 11, 22 and 33. Vowels are A,E,I,O,U; Y is a consonant. Latin transliteration only. A symbolic reflection practice, not a scientific prediction.",
  };
}
export const tarotDeck = [
  [
    "The Fool",
    "Beginnings",
    "What small step would make space for something new?",
  ],
  [
    "The Magician",
    "Resourcefulness",
    "Which skill or resource can you put into practice today?",
  ],
  [
    "The High Priestess",
    "Intuition",
    "What becomes clearer when you pause before responding?",
  ],
  ["The Empress", "Nurture", "What needs more care and room to grow?"],
  ["The Emperor", "Structure", "Which boundary would support your next step?"],
  ["The Hierophant", "Tradition", "Which inherited belief still serves you?"],
  ["The Lovers", "Alignment", "What choice reflects your values?"],
  ["The Chariot", "Direction", "Where would focused effort help?"],
  ["Strength", "Patience", "How can you respond with gentle courage?"],
  ["The Hermit", "Reflection", "What can a moment of solitude reveal?"],
  [
    "Wheel of Fortune",
    "Change",
    "What is within your influence as circumstances change?",
  ],
  ["Justice", "Accountability", "What would a fair next step look like?"],
  ["The Hanged Man", "Perspective", "How might this look from another angle?"],
  ["Death", "Transition", "What are you ready to release?"],
  [
    "Temperance",
    "Balance",
    "Where could you find a sustainable middle ground?",
  ],
  ["The Devil", "Attachments", "Which habit limits your freedom?"],
  ["The Tower", "Reassessment", "What assumption is ready to be questioned?"],
  ["The Star", "Hope", "What offers a steady source of encouragement?"],
  ["The Moon", "Uncertainty", "What information do you need before deciding?"],
  ["The Sun", "Clarity", "What brings a sense of openness and joy?"],
  ["Judgement", "Renewal", "What lesson are you ready to act on?"],
  [
    "The World",
    "Integration",
    "What deserves acknowledgement before the next chapter?",
  ],
];
export function tarot({ question, spread, positions }) {
  if (!question?.trim() || question.length > 1000)
    throw Error("Enter a question up to 1000 characters.");
  const count = spread === "three" ? 3 : spread === "one" ? 1 : 0;
  if (
    !count ||
    !Array.isArray(positions) ||
    positions.length !== count ||
    new Set(positions).size !== count ||
    positions.some((x) => !Number.isInteger(x) || x < 0 || x > 21)
  )
    throw Error("Choose distinct cards for this spread.");
  const shuffled = [...tarotDeck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return {
    type: "tarot",
    question,
    spread,
    cards: positions.map((x, i) => ({
      position:
        count === 1
          ? "Reflection"
          : ["Past influences", "Present focus", "Possible direction"][i],
      name: shuffled[x][0],
      theme: shuffled[x][1],
      reflection: shuffled[x][2],
    })),
    method:
      "22 Major Arcana; upright cards only. A cryptographically shuffled deck is generated on submission and your selected positions are revealed. Prompts are curated reflective questions, not predictions.",
  };
}
