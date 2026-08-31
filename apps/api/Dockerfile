# FleetScope bounded API — Cloud Run target.
#
# Constraints this image honors:
#   - production dependencies only
#   - non-root runtime user
#   - listens on $PORT, defaults to 8080
#   - NO baked secrets: credentials come from the Cloud Run service account
#   - NO always-on worker or cron; a bounded Python child starts only after an
#     admitted run, so the service can still idle at zero with min-instances=0
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/domain/package.json ./packages/domain/
COPY packages/event-schema/package.json ./packages/event-schema/
COPY packages/platform-adapters/package.json ./packages/platform-adapters/
COPY packages/run-ledger/package.json ./packages/run-ledger/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --prod --filter @fleetscope/api...

# ── Python ADK worker ────────────────────────────────────────────────────────
# Build it in the same Debian base as the final image so the virtualenv's
# interpreter and native wheels remain runnable after the copy.
FROM base AS adk-deps
WORKDIR /worker
COPY apps/adk-worker/pyproject.toml ./pyproject.toml
COPY apps/adk-worker/src ./src
RUN python3 -m venv /opt/fleetscope-venv \
    && /opt/fleetscope-venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/fleetscope-venv/bin/pip install --no-cache-dir .

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM base AS runtime
WORKDIR /repo
ENV NODE_ENV=production
ENV APP_ENV=production
# Recorded-only unless the deployment explicitly overrides it.
ENV LIVE_MODE=false
ENV PORT=8080
# The image contains the ADK worker, but it remains pure/recorded until an
# operator explicitly supplies the live Vertex configuration at deployment.
ENV FLEETSCOPE_RUN_WORKER_MODE=pure
ENV FLEETSCOPE_RUN_DRIVER=worker
ENV FLEETSCOPE_WORKER_PYTHON=/opt/fleetscope-venv/bin/python
ENV FLEETSCOPE_WORKER_DIR=/repo
ENV FLEETSCOPE_WORKER_PYTHONPATH=/opt/fleetscope-venv/lib/python3.11/site-packages
# The image's default pure worker must not reach GitHub or any other network
# during a local/recorded smoke. ADK mode ignores this flag and uses its own
# explicit Vertex/ADC gates.
ENV FLEETSCOPE_WORKER_OFFLINE=true
# Cloud Run's writable layer is process-local/ephemeral. This path is useful
# for health and recorded smoke checks, but it is not restart-durable proof.
ENV FLEETSCOPE_RUN_LEDGER=/tmp/fleetscope/runs.jsonl
ENV FLEETSCOPE_ATTEMPT_LEDGER=/tmp/fleetscope/attempts.jsonl

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=adk-deps /opt/fleetscope-venv /opt/fleetscope-venv
COPY package.json pnpm-workspace.yaml ./
COPY apps/api ./apps/api
COPY apps/adk-worker ./apps/adk-worker
COPY packages/domain ./packages/domain
COPY packages/event-schema ./packages/event-schema
COPY packages/platform-adapters ./packages/platform-adapters
COPY packages/run-ledger ./packages/run-ledger
COPY packages/shared ./packages/shared

RUN mkdir -p /tmp/fleetscope && chown -R node:node /tmp/fleetscope
USER node
EXPOSE 8080
# Resolve the API's runtime dependencies (including tsx) from its workspace
# package rather than relying on a root-level dev dependency symlink.
WORKDIR /repo/apps/api
CMD ["node", "--import", "tsx", "src/server.ts"]
