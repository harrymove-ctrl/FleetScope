# Devpost additional-info — how to invoke and what to tick

**Status:** operator packet for Harry. Do not paste personal fields until you
confirm them. This file does not submit the form.

**Form:**
[additional-info/edit](https://devpost.com/submit-to/30845-all-things-agentic-hackathon/manage/submissions/1152968-fleetscope/additional-info/edit)

**Repo:** https://github.com/harrymove-ctrl/FleetScope
(`feat/agent-viewer-cli`)

Judges cannot log into the GCP project. Send them FleetScope's own Cloud
Console, not `console.cloud.google.com`.

## 30-second fill order

1. Category **The Taskmaster**.
2. Repo URL + README reproducible testing = **Yes**.
3. Hosted URL + private testing instructions (below).
4. SDKs: ADK + Google GenAI SDK. Antigravity SDK only if you want the `agy`
   producer counted.
5. Cloud services: **Cloud Run** only (the form has no Cloud Storage box).
6. Upload `docs/product/fleetscope-devpost-architecture.png`.
7. Models: **Gemini 3.7 Flash** (satisfies Gemini 3.5+). Do not tick Veo /
   Lyria / Gemma — they are not in this product.
8. Leave Startup Prize blank unless you have an incorporated org and a
   corporate email.
9. You still fill: submitter type, country, org name if any, start date.

## Field-by-field

| Field | Tick / paste | Why | You must confirm |
|---|---|---|---|
| Sponsor / Special Prizes · Startup Excellence | Leave **unticked** unless incorporated | Rules require an incorporated org and a corporate email | Yes, if you want that prize |
| Submitter Type | Individual unless you submit as the org | Gallery field | Yes |
| Submitter country of residence | Your country | Gallery field | Yes |
| Which Category | **The Taskmaster** | `launch_readiness` completes a multi-step job and issues READY / NOT_READY. Viewer is evidence, not the 40% action product. Do not pick Collaborative Partner or Fortified Enterprise Fleet. | No |
| Organization name | Blank, or the incorporated name | Required only if submitting as an org | Yes |
| What date did you start this project? | **08-26-26** | First git commit `b196f060` on 2026-08-26 | Confirm this is the Devpost “newly created” date you want |
| URL to public or private code repo | `https://github.com/harrymove-ctrl/FleetScope` | Fork of `jasong-03/FleetScope`. Submission branch `feat/agent-viewer-cli`. | If the default branch is not this one, say so in testing instructions |
| If private, share with | `testing@devpost.com` and `cloudhackathons@google.com` | Only if the repo is private | Check GitHub visibility |
| Did you add Reproducible Testing instructions to your README? | **Yes** | README section **Reproducible testing** | No |
| Hosted project URL | `https://fleetscope-web-6tes2q7oqa-uc.a.run.app` | Cloud Run `fleetscope-web` revision `fleetscope-web-00001-g4s`, `us-central1`. Official rules allow tearing it down after the video. Redeploy after this change so `/console` exists on the hosted site. | Keep it up through the video; optional after |
| Testing instructions (private) | Paste the block below | Seen by Devpost and judges only | No |
| Which Google SDK | **Agent Development Kit (ADK)** and **Google GenAI SDK (google-genai)** | `google-adk==2.8.0`; worker imports `google.genai.types`. Optional: **Antigravity SDK** if you count `agy --print --output-format stream-json`. **Genkit** = no. | Antigravity tick is a judgement call |
| Which Google Cloud Service(s) | **Cloud Run** | Also used: Cloud Storage `buckets.get` and optional proof upload, Vertex AI. Those are not in this checkbox list. Do not tick Cloud SQL, Firestore, GKE, or Pub/Sub. | No |
| Architecture diagram | `docs/product/fleetscope-devpost-architecture.png` | SVG source next to it. AI-generated is allowed if accurate. | No |
| Startup Prize org name | Blank unless opting in | Incorporated org only | Yes |
| Startup Prize corporate email | Blank unless opting in | Must be the corporate address | Yes |
| Which Google AI Models | **Gemini 3.7 Flash** (Gemini 3.5+ required) | Provider-observed `modelVersion` `gemini-3.7-flash` on 2026-08-31. No Veo / Lyria / Gemma in the product. | No |
| Bonus blog / video | Only if public and it says it was made for this hackathon | Skip if missing | Yes |
| Bonus social | Only if public and tagged `#AllThingsAgenticHackathon` | Official hashtag from the Devpost page. The form text also says `#AllThingsAgentic Hackathon`. | Yes |

## Private testing instructions (paste into Devpost)

```text
FleetScope is a read-only Session Observer. Google ADK agents inspect Cloud Run
and Cloud Storage, then issue READY or NOT_READY. The viewer never starts Vertex.

Hosted (no login, no spend):
  https://fleetscope-web-6tes2q7oqa-uc.a.run.app/console
  https://fleetscope-web-6tes2q7oqa-uc.a.run.app/demo
  https://fleetscope-web-6tes2q7oqa-uc.a.run.app/viewer/
  curl -fsS https://fleetscope-api-6tes2q7oqa-uc.a.run.app/health
  curl -fsS https://fleetscope-api-6tes2q7oqa-uc.a.run.app/cloud/console
  curl -fsS https://fleetscope-api-6tes2q7oqa-uc.a.run.app/runs/capability

The API is recorded-only (liveMode: false). Those GETs cannot spend tokens.

Zero-cost local reproduce (README “Reproducible testing”):
  git clone --branch feat/agent-viewer-cli --single-branch \
    https://github.com/harrymove-ctrl/FleetScope.git
  cd FleetScope
  pnpm install --frozen-lockfile
  cargo run -p fleetscope-cli --bin fleetscope -- inspect \
    crates/fleetscope-cli/tests/fixtures/google-cloud-launch-readiness
  pnpm demo:google-session -- --project example-project --location us-central1 \
    --service fleetscope --bucket fleetscope-sessions-demo

Do not run `pnpm demo:google-session -- --run` unless you intend to spend
Vertex. Do not parse Antigravity's private conversation store.

Architecture: docs/product/fleetscope-devpost-architecture.png
Feature map: docs/product/feature-inventory.md
```

## How to invoke every live surface

| What judges should see | Invoke | Spends? |
|---|---|---|
| Decision + Cloud proof without GCP login | Hosted `/console` or `GET /cloud/console` | No |
| Non-interactive session poster | `/demo` | No |
| Interactive graph / inspector | `/viewer` (hosted uses bundled demo; local auto-follows `.fleetscope/sessions` on 127.0.0.1) | No |
| Native TUI | `cargo run -p fleetscope-cli --bin fleetscope -- examples/gemini-session --follow --tiny` | No |
| Headless inspect | `fleetscope inspect` on the launch-readiness fixture | No |
| Producer plan only | `pnpm demo:google-session -- --project example-project --location us-central1 --service fleetscope --bucket fleetscope-sessions-demo` | No |
| Real Vertex take | `pnpm demo:google-session -- --run` with ADC + spend opt-ins | **Yes** |
| Antigravity 5-worker fan-out | `pnpm demo:antigravity` | Quota / workers |
| Operator gcloud (video only) | `gcloud run services describe fleetscope-web --region us-central1 --project project-ac0c5f88-868b-46b9-a2e` | No, but needs your IAM |

## Honest limits

- `console.cloud.google.com` links require project IAM. Judges will bounce.
  `/console` is the interactive substitute.
- Hosted API CORS is empty by default, so the browser page uses the bundled
  snapshot and does not need the API. Curl against the API is the backend.
- Bundled ADK session `e-d9651b51-…` and Vertex take `e-04e1149b-…` are
  different ids. Do not present them as one run.
- Cloud Storage object generation was not uploaded. Tick Cloud Run, describe
  Storage as a read-only `buckets.get` in the architecture and README.
- CASE-1042 / Warden / Catalog routes still exist in the web app. They are not
  the submission story. Do not demo them.

## Video mapping (judges' Q&A)

| Beat | Time | Show |
|---|---|---|
| Hook: four agents decide READY | 0:00–0:30 | `/console` overview + decision |
| Human voice, not TTS | whole take | Operator |
| Google Cloud proof | 0:30–0:50 | Hosted `.run.app` + `/console` Cloud Run panel (gcloud optional) |
| Skip waiting | if a live run is slow | Recorded JSONL + inspect |
| README safety net | after video | This file + feature-inventory + folder structure in README |
