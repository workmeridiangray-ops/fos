# Cloud Run deployment

Intended project: `meridian-gray`; intended region: `asia-south1`; service: `chart-api`. Google CLI sign-in and access to the active `meridian-gray` project were verified on 13 November 2026. However, `gcloud billing projects describe meridian-gray` returned `billingEnabled: false`. Billing must be enabled before deployment. No Cloud Run service has been deployed by this integration yet.

The replacement `charnnt-api.zip` supplies a Dockerfile with native build tools, a .dockerignore, and updated Docker/Cloud Run instructions. Compared with the earlier `chart-api.zip`, all calculation modules, API code, dependencies and licences are byte-identical; only those three deployment files were added or changed. Replacement archive SHA-256: `960c4f9cfee04bbbad33ef9fe80e4d5b1ab13e25550b88bfeb9eb9280704e78c`.

The repository retains the hardened container and API already implemented: Python 3.12 multistage build with native build tools confined to the builder, non-root runtime, pinned dependencies, allowlisted upload context, required API key and fresh-process isolation. The supplied Dockerfile uses a single root-running stage and broad `COPY . .`; its API still makes authentication optional and retains mutable calculation state. Replacing the integrated service with those unchanged originals would undo the completed isolation and privacy work. The archive's example deploy commands are documentation, not authorization to deploy or to use its example key.

The container listens on `PORT`. Docker/Podman was unavailable here, so an actual container build is still required. Native Python 3.13 calculation/API tests passed; these are not a substitute for a Linux container build.

## Prerequisites

1. Complete the licensing requirements in `chart-service/NOTICE.md` for the AGPL-marked engine modules, Swiss Ephemeris and pyswisseph before public activation.
2. Google CLI sign-in and project access have been verified. Billing must be enabled (the last check returned false) and the deployer must have Cloud Run source-deploy, Cloud Build, Artifact Registry, service-account and Secret Manager permissions. Organization policy may restrict public Cloud Run ingress.
3. Keep the existing Wrangler login available for account `348471314fadbd57e39a68b2eadb5984` if connecting the website. Source Worker: `flames-of-shiva`; D1: `flames-of-shiva` / `acd61056-a1ff-42d1-aea3-96dc1512d05d`.

## Deploy

Review the executable `scripts-deploy-chart-cloudrun.py`. After login and licence readiness:

```sh
python3 scripts-deploy-chart-cloudrun.py --license-ready
```

This enables the required APIs, creates a dedicated runtime service account, creates/reuses a Secret Manager shared key, grants that runtime access only to that secret, builds the Dockerfile through Cloud Build and deploys to Cloud Run. The native dependency is built on Google's infrastructure; Docker is not required locally. The service permits public HTTPS transport but **POST /chart remains protected by the API key**. Health reveals no birth details. Defaults: one CPU, 1 GiB, concurrency two, zero minimum instances, two maximum instances, 60-second request timeout. These bound compute capacity; they are not a billing budget. Runtime service account has no general project role.

Cloud Build may need a build service-account role grant in the selected project; if Google reports one, apply the precise requested permission to its actual build identity rather than granting project-wide Editor. A failed build or IAM policy change must be resolved and verified before marking deployment complete.

To also migrate and deploy this website Worker and connect backend credentials:

```sh
python3 scripts-deploy-chart-cloudrun.py --license-ready --connect-worker
```

The script verifies Cloud Run `/health`, then applies only repository migrations to the **remote** existing D1, deploys the Worker, and passes the URL/key to `wrangler secret bulk` through stdin. The key is never printed, written to source, embedded in a command argument, or exposed to the browser. Existing Secret Manager keys are reused, not silently rotated. This flow creates a Cloud Run HTTPS endpoint, not a public URL for this temporary workstation.

After deployment, sign into the website and generate a new chart from a distinct profile. Confirm saved retrieval, all divisions, a fine dasha branch and print output. Do not use or upload the supplied personal fixture as a production smoke test. Inspect Cloud Run metrics for memory/CPU/timeouts and tune bounded capacity from observed traffic.

Cloudflare Worker alone can be deployed while the Python host remains unconfigured; it then shows explicit service-unavailable states and still supports profile storage. Do not call that a working live chart integration.

For Swiss data files, provide the required licensed `.se1` files inside an approved image or mounted storage, set `EPHE_PATH` and `REQUIRE_SWISS_EPHEMERIS=true`, then verify returned settings. No data files were supplied; current local results truthfully report Moshier fallback.

Primary deployment references: [Cloud Run source deployments](https://docs.cloud.google.com/run/docs/deploying-source-code), [gcloud run deploy options](https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy), [Cloud Run secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets).
