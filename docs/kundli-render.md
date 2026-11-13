# Render free chart service

The owner selected free Render hosting on 13 November 2026. Do not enable Google Cloud billing or deploy Google Cloud resources. The Cloudflare website and D1/R2 continue to store private user data; Render runs only the stateless calculation service.

## Configuration

`render.yaml` defines one Docker web service, Free compute, Singapore, with health check `/health`. The Docker build context is `chart-service`, using its allowlisted `.dockerignore`. No database, disk, paid instance or paid workspace is required. Automatic deploys are disabled so a later commit cannot silently change the engine behind the versioned AGPL source offer.

The Blueprint generates a random `CHART_API_KEY`. Keep it in Render's environment settings and Cloudflare Worker secrets only. `CHART_MAX_JOBS=1` limits memory use and returns a retryable busy response for excess simultaneous calculations. No CORS setting is needed for server-to-server Worker calls.

Render Free sleeps after 15 minutes idle and may take about a minute to wake. The Worker allows 120 seconds for the upstream response; the idempotency reservation lasts 150 seconds. Loading copy explains the possible two-minute wait. There is no artificial keep-alive job. Free usage is shared with other services in the workspace. Check existing billing/payment settings before creating the service: select only Free compute and do not enable paid overages or add a payment method. If the account cannot enforce the owner's zero-spend constraint, stop before creation.

Local synthetic D1–D60 calculation measured 19.7 MiB peak child RSS and 0.04 seconds on the development Mac. This is a sizing indication, not a Render benchmark. The actual remote container build, calculation and fine-period response must pass before connecting production.

## Deployment and verification

1. Publish the exact source tree and immutable `kundli-agpl-v1` tag, including upstream dependency source and notices. Verify the archive and licence links before activation.
2. Connect Render and inspect the workspace and existing services. Create the Blueprint or equivalent Docker web service with exactly the Free configuration above.
3. Verify `/health`, `/source`, `/license`, missing-key rejection and an authenticated synthetic `/chart` request. Verify both a base calculation and a selected fine-period branch; do not use personal supplied fixtures.
4. Pass the same API key and HTTPS base URL to Wrangler `secret bulk` over stdin as `CHART_API_KEY` and `CHART_API_URL`. Never put the key in a command argument, committed file, screenshot or chat.
5. Apply D1 migration 006 remotely, build/deploy the Worker, and perform an authenticated create/save/reopen/print smoke test. Check a request after idle sleep if practical; report this separately if not yet verified.
6. Record the actual URL, service/deploy ID, Git commit and Worker version in the completion report.

References: https://render.com/docs/free and https://render.com/docs/blueprint-spec

## Actual deployment

Service `srv-dbrfk356e07s73bi0l60` in the owner-confirmed `mg` workspace is live at https://flames-of-shiva-chart-api.onrender.com on Free compute, Singapore. It was created directly with the official Render CLI using `chart-service` as root directory; default Docker context `.` and Dockerfile `./Dockerfile` are relative to that root and match the Blueprint build inputs. Auto-deploy is off. The API key is generated and stored as a Render environment variable. Deploy `dep-dbrj3h56e07s73bsj9e0` activated it; base/fine calculation and source/licence checks passed. No paid compute or Google Cloud resource was created. Cloudflare connection is pending renewed CLI authentication.
