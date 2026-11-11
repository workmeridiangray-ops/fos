import { createHmac, timingSafeEqual } from "node:crypto";
export class SetupRequired extends Error {
  constructor(message) {
    super(message);
    this.status = 503;
  }
}
export function createIntegrations(env) {
  async function sendEmail(to, subject, text) {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM)
      throw new SetupRequired(
        "Email delivery requires RESEND_API_KEY and EMAIL_FROM. Your account is saved; retry verification after email is configured.",
      );
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new SetupRequired(
        "Email provider could not deliver your code. Retry later.",
      );
  }
  async function stripe(path, params, key) {
    if (!env.STRIPE_SECRET_KEY)
      throw new SetupRequired(
        "Secure checkout requires payment provider setup. No payment has been taken.",
      );
    const response = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": key,
      },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok)
      throw new SetupRequired(
        data.error?.message || "Payment provider unavailable.",
      );
    return data;
  }
  function verifyWebhook(raw, signature, secret, now = Date.now()) {
    if (!secret) throw new SetupRequired("Webhook secret is not configured.");
    const fields = (signature || "").split(",").map((x) => x.split("="));
    const timestamp = fields.find((x) => x[0] === "t")?.[1];
    if (!timestamp || Math.abs(now / 1000 - Number(timestamp)) > 300)
      throw Error("Expired webhook signature.");
    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.${raw}`)
      .digest();
    const good = fields
      .filter((x) => x[0] === "v1")
      .some(([, value]) => {
        const actual = Buffer.from(value || "", "hex");
        return (
          actual.length === expected.length && timingSafeEqual(actual, expected)
        );
      });
    if (!good) throw Error("Invalid webhook signature.");
    return JSON.parse(raw);
  }
  async function astrology(type, input) {
    if (!env.ASTROLOGY_PROVIDER_URL || !env.ASTROLOGY_PROVIDER_KEY)
      throw new SetupRequired(
        "A Vedic astrology provider is not configured. No compatibility scores or predictions have been generated.",
      );
    const response = await fetch(
      `${env.ASTROLOGY_PROVIDER_URL.replace(/\/$/, "")}/${type}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.ASTROLOGY_PROVIDER_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(25000),
      },
    );
    if (!response.ok)
      throw new SetupRequired(
        "The astrology provider is unavailable. Your details have not been lost.",
      );
    const data = await response.json();
    if (!data.assumptions || !data.report)
      throw new SetupRequired(
        "The provider returned an incomplete report. Calculation assumptions are required.",
      );
    return { type, ...data };
  }
  async function mediaRoom(booking, user) {
    if (!env.DAILY_API_KEY)
      throw new SetupRequired(
        "Voice and video require DAILY_API_KEY. No live call has been started.",
      );
    const name = "fos-" + booking.id,
      exp = Math.floor(new Date(booking.ends).getTime() / 1000);
    async function call(path, method = "GET", payload) {
      const r = await fetch("https://api.daily.co/v1/" + path, {
        method,
        headers: {
          Authorization: `Bearer ${env.DAILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(15000),
      });
      return { ok: r.ok, status: r.status, data: await r.json() };
    }
    let room = await call("rooms/" + name);
    if (room.status === 404) {
      room = await call("rooms", "POST", {
        name,
        privacy: "private",
        properties: {
          exp,
          eject_at_room_exp: true,
          max_participants: 2,
          enable_chat: true,
          start_video_off: booking.format === "voice",
        },
      });
      if (!room.ok) room = await call("rooms/" + name);
    }
    if (!room.ok)
      throw new SetupRequired(
        "The communication provider could not open this room. Please reconnect.",
      );
    const token = await call("meeting-tokens", "POST", {
      properties: {
        room_name: name,
        user_id: user.id,
        user_name: user.name,
        exp,
        eject_at_token_exp: true,
        is_owner: user.id === booking.reader,
        start_video_off: booking.format === "voice",
      },
    });
    if (!token.ok || !token.data.token)
      throw new SetupRequired(
        "A private room token could not be issued. Please reconnect.",
      );
    const url = new URL(room.data.url);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".daily.co"))
      throw new SetupRequired("Unexpected room provider response.");
    url.searchParams.set("t", token.data.token);
    return { url: url.href, expires: exp };
  }

  let geocoderNextRequest = 0;
  const placeCache = new Map();
  async function searchPlaces(query) {
    if (!env.GEOCODER_URL)
      throw new SetupRequired(
        "Global birthplace search requires a configured geocoder. Select a reference city or enter coordinates manually.",
      );
    const cached = placeCache.get(query.toLowerCase());
    if (cached && cached.expires > Date.now()) return cached.data;
    if (Date.now() < geocoderNextRequest)
      throw Object.assign(
        new Error("Please wait a moment before another place search."),
        { status: 429 },
      );
    geocoderNextRequest = Date.now() + 1100;
    const endpoint = new URL(env.GEOCODER_URL);
    if (endpoint.hostname === "nominatim.openstreetmap.org")
      throw new SetupRequired(
        "Configure your own or a contracted Nominatim-compatible endpoint; the public community endpoint is not enabled by default.",
      );
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("format", "jsonv2");
    endpoint.searchParams.set("limit", "5");
    const response = await fetch(endpoint, {
      headers: {
        "User-Agent":
          "FlamesOfShiva/1.0 (" + (env.APP_ORIGIN || "local-development") + ")",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new SetupRequired(
        "The birthplace search service is unavailable. Enter coordinates manually or retry.",
      );
    const rows = await response.json();
    if (!Array.isArray(rows))
      throw new SetupRequired("The geocoder returned an invalid response.");
    const data = rows
      .slice(0, 5)
      .map((r) => ({
        name: String(r.display_name),
        latitude: Number(r.lat),
        longitude: Number(r.lon),
      }))
      .filter(
        (r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude),
      );
    placeCache.set(query.toLowerCase(), {
      data,
      expires: Date.now() + 86400000,
    });
    if (placeCache.size > 1000)
      placeCache.delete(placeCache.keys().next().value);
    return data;
  }

  return {
    sendEmail,
    stripe,
    verifyWebhook,
    astrology,
    mediaRoom,
    searchPlaces,
  };
}
export const {
  sendEmail,
  stripe,
  verifyWebhook,
  astrology,
  mediaRoom,
  searchPlaces,
} = createIntegrations(process.env);
