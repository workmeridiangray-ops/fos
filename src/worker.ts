// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Flames of Shiva contributors
import timezoneLookup from "@photostructure/tz-lookup";
import { createApplication } from "./application.js";
import { createIntegrations } from "./integrations.js";
import { createSQLStore } from "./sql-store.js";
import { sanitizeImage } from "./worker-images.js";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      const asset = await env.ASSETS.fetch(request);
      const response = new Response(asset.body, asset);
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("Referrer-Policy", "same-origin");
      response.headers.set("X-Frame-Options", "DENY");
      response.headers.set(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'; base-uri 'self'",
      );
      return response;
    }
    const store = createSQLStore({
      one: (sql: string, ...args: unknown[]) =>
        env.DB.prepare(sql)
          .bind(...args)
          .first(),
      all: async (sql: string, ...args: unknown[]) =>
        (
          await env.DB.prepare(sql)
            .bind(...args)
            .all()
        ).results,
      batch: async (statements: [string, unknown[]][]) =>
        (
          await env.DB.batch(
            statements.map(([sql, args]) => env.DB.prepare(sql).bind(...args)),
          )
        ).map((r) => r.meta),
    });
    // One application per request keeps secrets, response state, and transaction
    // buffers isolated; no request I/O or bindings are cached in module globals.
    const app = createApplication({
      ...store,
      storageDescription: "Private Cloudflare R2",
      imageError:
        "Use a valid PNG or JPEG up to four megapixels and 5 MB. Reduce the image dimensions and retry.",
      env: {
        ...env,
        APP_ORIGIN: env.APP_ORIGIN || url.origin,
        NODE_ENV: "production",
      },
      integrations: createIntegrations(env),
      coordinateTimezones: (latitude: number, longitude: number) => [
        timezoneLookup(latitude, longitude),
      ],
      transformImage: sanitizeImage,
      putUpload: async (id: string, bytes: Uint8Array) => {
        await env.UPLOADS.put(id, bytes);
      },
      readUpload: async (id: string) => {
        const object = await env.UPLOADS.get(id);
        if (!object)
          throw Object.assign(new Error("File not found."), { status: 404 });
        return object.body;
      },
      serveStatic: () => {
        throw Error("Static requests are handled by the asset binding.");
      },
      rate: async (key: string, max: number) => {
        const limiter =
          max <= 5
            ? env.CODE_LIMIT
            : max <= 15
              ? env.AUTH_LIMIT
              : env.API_LIMIT;
        if (!(await limiter.limit({ key })).success)
          throw Object.assign(
            new Error("Too many requests. Please wait a minute."),
            { status: 429 },
          );
      },
    });
    const headers = new Headers();
    let status = 200;
    let responseBody: BodyInit | null = null;
    const res = {
      setHeader: (name: string, value: string) =>
        headers.set(name, String(value)),
      writeHead: (code: number, values: Record<string, string> = {}) => {
        status = code;
        for (const [name, value] of Object.entries(values))
          headers.set(name, String(value));
      },
      end: (value: BodyInit | null) => {
        responseBody = value ?? null;
      },
    };
    const req = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers),
      socket: {
        remoteAddress: request.headers.get("CF-Connecting-IP") || "unknown",
      },
      async *[Symbol.asyncIterator]() {
        if (!request.body) return;
        const reader = request.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) return;
            yield Buffer.from(value);
          }
        } finally {
          await reader.cancel();
          reader.releaseLock();
        }
      },
    };
    try {
      await app(req, res);
      return new Response(responseBody, { status, headers });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "request_failed",
          path: url.pathname,
          name: error instanceof Error ? error.name : "Error",
        }),
      );
      return Response.json(
        { error: "The service is temporarily unavailable. Please retry." },
        { status: 500 },
      );
    }
  },
} satisfies ExportedHandler<Env>;
