# FleetScope — kịch bản thuyết trình & video demo

**Status:** ready to record
**Video length:** 3:45 (chuẩn < 4:00)
**Last updated:** 2026-08-31

Quy tắc bất biến: **Gemini/ADK quyết định (actor) — FleetScope ghi nhận (observer).**
Dẫn bằng *quyết định* READY/NOT_READY, không dẫn bằng viewer — 40% điểm nằm ở
"agents that decide and complete tasks".

Lời thoại tiếng Anh để đọc thẳng trên teleprompter. Chỉ dẫn sân khấu tiếng Việt.

---

## ⚠️ Bốn câu KHÔNG được nói (đã kiểm chứng trong code)

| Câu sai | Thực tế trong repo | Nói thế nào cho đúng |
|---|---|---|
| "cryptographic proof" | `Projection::fingerprint()` là **FNV-1a 64-bit** (`crates/agent-viewer-core/src/lib.rs:75`). Không ký, không chống va chạm. Doc comment của chính nó nói mục đích là "assert native/browser parity". `.proof` cũng chỉ là JSON metadata, không hash, không chữ ký. | "a reproducible projection fingerprint — the same session projects to the same sixteen hex digits in the terminal and in the browser" |
| `--follow` trên `examples/gemini-session` rồi nói "the right edge expands in real time" | `fleetscope --help` ghi rõ: `--follow` = *"open parked at the live edge **instead of replaying**"*. File đó là file tĩnh đã checked-in, `follow.rs` poll thấy không có dòng mới → **màn hình đứng yên**. Giám khảo sẽ thấy. | Bỏ `--follow`, dùng replay mặc định + `--speed`. Đó mới là cái animate. |
| "press **F** to snap back to the live edge" | Theo `--help` của binary: `f` = **follow**, `g` = **live edge**. | "press `g` for the live edge" |
| "storage_probe verifies storage bucket integrity" | Nó gọi đúng một `buckets.get` — đọc metadata. Không đọc nội dung object, không verify integrity. | "reads the bucket's metadata — one call, no object contents" |

Lý do khắt khe: cả pitch này dựng trên câu "chúng tôi không bịa". Bịa một chữ
"cryptographic" là tự bắn vào luận điểm mạnh nhất của chính mình.

---

## 0. Pre-flight (2 phút trước khi bấm REC)

| Pane / Tab | Nội dung | Chuẩn bị |
|---|---|---|
| **Terminal A** | repo FleetScope | chữ ≥ 18pt, nền tối, `clear` |
| **Terminal B** | gcloud | `gcloud config set project project-ac0c5f88-868b-46b9-a2e` |
| **Browser 1** | `https://fleetscope-web-6tes2q7oqa-uc.a.run.app/demo/` | load sẵn |
| **Browser 2** | Cloud Run console, service `fleetscope-web` | tab Revisions |
| **Slides** | 6 slide | presenter view |

Kiểm tra:

```bash
curl -s https://fleetscope-api-6tes2q7oqa-uc.a.run.app/health
```

Phải ra `{"status":"ok",...,"liveMode":false,...}`.

Tắt notification, Slack, mail.

> 🔴 **Bằng chứng Vertex thật đang bị gitignore.**
> Session `e-04e1149b-7b8b-4529-951d-9029e6c7bfdb` (projection
> `ef62b782198ed6b3`) nằm ở `.fleetscope/sessions/fs-20260830T204924Z-98f69c07/`
> và `.gitignore:27` loại cả `.fleetscope/`. Giám khảo clone repo về **không
> thấy** bằng chứng mà checklist đang viện dẫn.
>
> **Đừng `cp -r` thẳng vào fixture.** File đó chứa project ID, tên bucket và URL
> Cloud Run thật; repo này public. Redact trước, rồi mới commit — hoặc upload
> lên Cloud Storage và ghi generation vào checklist. Video vẫn quay được vì file
> có sẵn trên máy.

---

## 1. Pitch deck — 6 slide, ~3:10

### Slide 1 — The problem (0:00–0:30)

**Slide:** bốn agent → một quyết định. Nền: JSONL thô bị gạch chéo.

> "Launch readiness is **not a chat**. It is a multi-step job: probe the
> service, check the storage, enforce the budget, and make the call.
> Today a human does that by reading dashboards. Hand it to agents instead and
> what comes back is a wall of raw JSONL. You cannot tell which agent ran, which
> tool is blocked, or whether silence means **finished** — or **dead**."

### Slide 2 — The agentic solution (0:30–1:10)

**Slide:** `SequentialAgent` + bốn con. Logo Vertex AI, Gemini 3.7 Flash, ADK 2.8.

> "So we built the readiness workflow as an autonomous multi-agent system on
> **Google ADK**. A `SequentialAgent` coordinates four children.
> `cloud_run_probe` performs one read-only check on the service.
> `storage_probe` reads the bucket's metadata — one call, no object contents.
> `budget_guard` validates the execution bounds: six model calls, two reads,
> zero writes. A seventh call is refused before it is issued.
> And `launch_reviewer` takes all three reports and renders the verdict:
> **READY** or **NOT READY**."

### Slide 3 — The evidence engine (1:10–1:50)

**Slide:** split — producer trái, FleetScope phải, mũi tên **một chiều**.

> "FleetScope is the window into that autonomous work.
> It never mutates state, never retries, never decides. It reads the
> append-only session log the producer owns and projects it: agent rails,
> parent-child trees, tool results, timeline.
> The session file is the single source of truth. There is no second version
> of reality."

Mũi tên chỉ đi một hướng. Đó **là** luận điểm — để nó trên màn hình lâu một nhịp.

### Slide 4 — Radical truth over guesses (1:50–2:25)

**Slide:** hai dòng thật từ `inspect`: `[ ] search_hotels no result recorded`
và `[no terminal event recorded]`.

> "Two rules, enforced at ingestion, not at render time.
> First, hidden reasoning is dropped before it can reach any surface.
> Second, terminal state comes only from what was recorded. An agent that never
> reported reads *no terminal event recorded*. A tool call that never came back
> is named as waiting.
> A stuck agent **has to look stuck**. We would rather show you *unknown* than
> show you a guess."

### Slide 5 — The Google stack (2:25–2:50)

**Slide:** `docs/product/fleetscope-devpost-architecture.png`.

> "Vertex AI Gemini 3.7 Flash, Google ADK two-point-eight, Cloud Run and Cloud
> Storage — tied together by one session ID.
> A Rust projection core drives three front ends: the terminal, the browser over
> WebAssembly, and a headless inspector. They share the same core, so the
> terminal and the browser cannot disagree about what a session says — and the
> projection fingerprint proves it: the same session projects to the same
> sixteen hex digits in both."

### Slide 6 — Replay and close (2:50–3:10)

**Slide:** timeline player + live-edge indicator.

> "And because the evidence is a file, finished work stays debuggable. Pause,
> step back through events, scrub the timeline, jump to the live edge — without
> paying for another model run.
> **Gemini does the work. FleetScope proves how it was decided.**"

Dừng ở đó. Đừng nói thêm.

---

## 2. Video demo — 3:45, một take

### 🎬 Shot 1 — The hook (0:00–0:20) · slide

Nói thẳng vào camera. Không "hi judges", không giới thiệu tên.

> "Deciding whether a production service is ready to launch is a multi-step job.
> Hand it to agents and you usually get back an unreadable wall of JSONL.
> We built four Gemini agents on Google ADK that autonomously decide **READY**
> or **NOT READY** — and FleetScope lets you audit exactly how they decided."

### 🎬 Shot 2 — Dry run + real Vertex evidence (0:20–1:15) · Terminal A

```bash
pnpm demo:google-session -- \
  --project project-ac0c5f88-868b-46b9-a2e \
  --location us-central1 \
  --service fleetscope-web \
  --bucket fleetscope-sessions-project-ac0c5f88-868b-46b9-a2e
```

Bốn cờ tài nguyên là **bắt buộc** — chạy trần sẽ lỗi `invalid project: ''`.

> "Without the run flag this is a zero-cost dry run. It validates the closed
> configuration and prints the exact plan: four agents, six model calls, two
> read-only Google Cloud operations, zero writes. Spending credit is an explicit
> opt-in, not a default."

Rồi mở lần chạy Vertex thật đã ghi:

```bash
cargo run -p fleetscope-cli --bin fleetscope -- \
  inspect .fleetscope/sessions/fs-20260830T204924Z-98f69c07
```

Rê chuột vào ba dòng đầu.

> "This is a recorded Vertex run. Producer `google-adk 2.8.0`, model
> `gemini-3.7-flash` — and that version is what the provider reported on the
> events, not what we configured. Five agents, fifteen events, both tool calls
> answered, zero failures."

Cuộn xuống dòng cuối.

> "And the verdict from `launch_reviewer`: **READY**."

**Nói "recorded", đừng nói "live".**

### 🎬 Shot 3 — Google Cloud proof (1:15–2:00) · Terminal B → Browser 1

```bash
gcloud run services describe fleetscope-web --region us-central1 \
  --format="value(status.url, status.latestReadyRevisionName)"
```

Ra đúng một dòng: URL + revision.

> "The viewer is deployed on Cloud Run in `us-central1`, project
> `project-ac0c5f88-868b-46b9-a2e`, revision `fleetscope-web-00001-g4s`."

**Đừng dùng `gcloud run services list`:** nó in email cá nhân ở cột LAST
DEPLOYED BY, và in URL dạng project-number khác URL trong checklist.

```bash
curl -s https://fleetscope-api-6tes2q7oqa-uc.a.run.app/health
```

> "And the deployed API answers `liveMode: false` — recorded-only until a live
> run is explicitly opted into. The guardrail is in the deployed service, not
> on a slide."

45 giây quan trọng nhất cho tiêu chí Cloud. Đừng vội.

### 🎬 Shot 4 — Replay and time travel (2:00–2:45) · Terminal A

```bash
cargo run -p fleetscope-cli --bin fleetscope -- examples/gemini-session --speed 4
```

**Không `--follow`.** `--follow` = "parked at the live edge instead of
replaying" — trên file tĩnh này màn hình sẽ **đứng im**. Replay mặc định mới
animate; `--speed 4` để vừa khung hình.

Thao tác: để chạy 3 giây → `space` (pause) → `[` `]` (step) → `g` (live edge).

> "This is the session replaying at four times speed — four agents, and the
> graph shows who handed work to whom.
> I press **space** to pause. I step back through the events with the brackets.
> And **g** jumps to the live edge. Time travel over the same file, with no
> second run."

**Muốn quay một run đang lớn thật** (tốn tiền, khó 1-take): `pnpm
demo:antigravity` ghi tăng dần vào `.fleetscope/sessions/antigravity-live/`;
lúc đó `--follow` mới đúng nghĩa và mép phải mới thật sự chạy.

### 🎬 Shot 5 — Truth over guesswork (2:45–3:30) · Terminal A

Ctrl-C, rồi:

```bash
cargo run -p fleetscope-cli --bin fleetscope -- inspect examples/gemini-session
```

Chỉ vào `hotel_search`.

> "Here is the part that matters. `search_hotels` was called twice and answered
> once. The retry never returned; the run failed with a rate limit and a
> thirty-second deadline. FleetScope does not average that away and does not
> guess — it prints *no result recorded*."

Chỉ vào agent không có terminal event.

> "And an agent that never reported its end reads *no terminal event recorded*.
> Not *completed*. Unknown before a guess, every time.
> Hidden reasoning is dropped at ingestion, so nothing marked `thought` can
> reach this screen at all."

### 🎬 Shot 6 — Cloud Run web demo + close (3:30–3:50) · Browser 1

Cuộn qua bảy reading trên `/demo/`.

> "The same session, rendered in the browser over WebAssembly, on Cloud Run.
> Google ADK and Gemini make the launch decision. FleetScope proves the decision
> happened.
> Thanks for watching."

Xem lại trong cửa sổ ẩn danh trước khi nộp.

---

## 3. Judge Q&A

**"Isn't this just another log viewer?"**

> "No. The product being judged is the autonomous ADK workflow that inspects
> real Google Cloud resources and issues a READY or NOT READY verdict.
> FleetScope is the audit plane — because an agent decision you cannot verify is
> not worth much in production."

**"Why not OpenTelemetry or Langfuse?"**

> "Zero instrumentation. We read the session file the producer already writes,
> so there is no SDK to maintain and no second source of truth to keep in sync.
> And we deliberately do not invent the fields the format does not record — no
> token counts, no cost, no latency panels filled with plausible numbers."

**"Did the model actually run, or is this mocked?"**

> "We separate configured from observed. `configuredModel` is what we asked for.
> Only the provider-owned `modelVersion` on the events earns the evidence label.
> In this run they agree, and we still show them as two different things."

**"Can it run live?"**

> "Yes, behind two explicit opt-ins. The deployed API reports `liveMode: false`
> by default. A metered run needs the run flag plus the spend and Vertex
> environment opt-ins inside the Python boundary."

**"Is the fingerprint tamper-evident?"** ← câu bẫy, phải trả lời thẳng

> "No, and we do not claim that. It is a fast non-cryptographic hash whose job
> is parity: the same session must project to the same digest in the terminal
> and in the browser. Tamper-evidence would need a signature, and we have not
> built one."

---

## 4. Phát âm

- **Google ADK** — *Ay-Dee-Kay*
- **SequentialAgent** — *see-KWEN-shul agent*
- **Gemini 3.7 Flash** — *JEM-ih-nye three point seven flash*
- **JSONL** — *JSON Lines*
- **Vertex** — *VER-teks*
- **WebAssembly** — *web-uh-SEM-blee*

---

## 5. Cấm nói

- ❌ "cryptographic proof" / "signed" / "tamper-proof" — không có chữ ký nào.
- ❌ FleetScope "launched / retried / approved / fixed" — nó **quan sát**.
- ❌ Gọi file đã xong là "live". File đang lớn = live follow; file đã xong =
  replay, kể cả khi đến từ cloud thật.
- ❌ `configuredModel` như bằng chứng đã chạy.
- ❌ CASE-1042 / Warden / Firestore / Pub/Sub — story cũ đã bỏ.
- ❌ Bịa token, cost, latency. Format không ghi thì không có.
- ❌ Để lộ API key, credential, prompt riêng trên màn hình.

---

## 6. Liên quan

- [Idea and pitch](idea-and-pitch.md)
- [Submission checklist](hackathon-submission-checklist.md)

`hackathon-official.md` và `session-readings-judge-demo.md` cũng nằm trong
`docs/product/` trên máy nhưng **chưa commit**, nên chưa link tới được từ đây.
