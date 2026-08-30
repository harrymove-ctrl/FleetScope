#!/usr/bin/env bash
#
# Deploy FleetScope to Cloud Run.
#
# Two services, deliberately:
#
#   fleetscope-web   the static viewer, nginx, no server code at all
#   fleetscope-api   the bounded read-only API
#
# They are separate because the API is a read-only JSON surface with no static
# file server, and teaching it to serve a site would widen a component whose
# narrowness is the point. Both land on Cloud Run, so both carry the platform
# evidence the submission needs.
#
# LIVE_MODE stays false. The image ships recorded-only, and a real model call
# costs money and needs its own explicit opt-in -- see the runtime runbook.
#
# Usage:
#   scripts/deploy-cloud-run.sh              # both services
#   scripts/deploy-cloud-run.sh web          # one of them
#   REGION=europe-west1 scripts/deploy-cloud-run.sh
set -euo pipefail

PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
REPO="${REPO:-fleetscope}"
TARGET="${1:-all}"

if [[ -z "${PROJECT}" || "${PROJECT}" == "(unset)" ]]; then
  echo "No project set. Run: gcloud config set project <id>" >&2
  exit 1
fi

HOST="${REGION}-docker.pkg.dev"
BASE="${HOST}/${PROJECT}/${REPO}"

echo "project ${PROJECT} · region ${REGION}"

# One Artifact Registry repository holds both images. Creating it is idempotent
# here so a first deploy on a clean project needs no manual step.
if ! gcloud artifacts repositories describe "${REPO}" \
  --location "${REGION}" --project "${PROJECT}" >/dev/null 2>&1; then
  echo "creating Artifact Registry repository ${REPO}"
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker --location "${REGION}" --project "${PROJECT}" \
    --description="FleetScope images"
fi

deploy_web() {
  if [[ ! -d apps/web/dist ]]; then
    echo "apps/web/dist is missing. Run: pnpm run build:web" >&2
    exit 1
  fi
  echo "── building fleetscope-web"
  gcloud builds submit --project "${PROJECT}" \
    --config deploy/cloudbuild.web.yaml \
    --substitutions "_IMAGE=${BASE}/web:latest" .

  echo "── deploying fleetscope-web"
  # Unauthenticated because a judge has to be able to open the URL. The
  # container holds only static files, so there is nothing behind it to reach.
  gcloud run deploy fleetscope-web --project "${PROJECT}" --region "${REGION}" \
    --image "${BASE}/web:latest" \
    --allow-unauthenticated \
    --min-instances=0 --max-instances=1 \
    --cpu=1 --memory=512Mi --port=8080
}

deploy_api() {
  echo "── building fleetscope-api"
  gcloud builds submit --project "${PROJECT}" \
    --config deploy/cloudbuild.api.yaml \
    --substitutions "_IMAGE=${BASE}/api:latest" .

  echo "── deploying fleetscope-api"
  # min-instances=0 and max-instances=1: the service idles at zero cost and
  # cannot fan out into a surprise bill.
  gcloud run deploy fleetscope-api --project "${PROJECT}" --region "${REGION}" \
    --image "${BASE}/api:latest" \
    --allow-unauthenticated \
    --min-instances=0 --max-instances=1 \
    --cpu=1 --memory=512Mi --port=8080 \
    --set-env-vars "APP_ENV=production,LIVE_MODE=false"
}

case "${TARGET}" in
  web) deploy_web ;;
  api) deploy_api ;;
  all) deploy_web; deploy_api ;;
  *) echo "usage: $0 [web|api|all]" >&2; exit 1 ;;
esac

echo
echo "── deployed"
for svc in fleetscope-web fleetscope-api; do
  url=$(gcloud run services describe "${svc}" --project "${PROJECT}" \
    --region "${REGION}" --format='value(status.url)' 2>/dev/null || true)
  rev=$(gcloud run services describe "${svc}" --project "${PROJECT}" \
    --region "${REGION}" --format='value(status.latestReadyRevisionName)' 2>/dev/null || true)
  [[ -n "${url}" ]] && printf '%-16s %s\n%-16s revision %s\n' "${svc}" "${url}" "" "${rev}"
done
