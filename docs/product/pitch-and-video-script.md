# FleetScope — kịch bản nói (pitch deck + video demo)

**Status:** active
**Last updated:** 2026-08-31
**Deadline:** 1 Sep 2026 07:00 GMT+7

Lời thoại để **đọc thẳng trên camera** viết bằng tiếng Anh. Chỉ dẫn sân khấu,
ghi chú và cảnh báo viết bằng tiếng Việt.

Quy tắc nền, không được phá: **Gemini/ADK làm việc, FleetScope chỉ quan sát.**
Dẫn bằng *quyết định* (READY/NOT_READY), không dẫn bằng viewer — 40% điểm nằm ở
"agents that decide and complete tasks".

---

## 0. Pre-flight — chuẩn bị trước khi bấm ghi

Mở sẵn, đúng thứ tự, mỗi thứ một tab/pane:

| # | Cửa sổ | Nội dung |
|---|---|---|
| 1 | Terminal A | `cd` vào repo, prompt sạch, font ≥ 16pt |
| 2 | Terminal B | đã `gcloud config set project project-ac0c5f88-868b-46b9-a2e` |
| 3 | Browser tab 1 | `https://fleetscope-web-6tes2q7oqa-uc.a.run.app/demo/` |
| 4 | Browser tab 2 | Cloud Run console, service `fleetscope-web` |
| 5 | Slide | 6 slide theo bảng ở Phần 1 |

Kiểm tra trước:

```bash
curl -s https://fleetscope-api-6tes2q7oqa-uc.a.run.app/health
```

Phải trả về `{"status":"ok",...,"liveMode":false,...}`. Nếu Cloud Run đã bị xoá
để khỏi tốn tiền thì **quay Console/gcloud thay cho URL sống** — luật hackathon
chấp nhận bằng chứng đã deploy, không bắt phải còn sống.

Tắt: notification, Slack, mail, mọi thứ có thể nhảy lên màn hình.

> **Cảnh báo — bằng chứng Vertex thật đang bị gitignore.**
> Session `e-04e1149b-7b8b-4529-951d-9029e6c7bfdb` (projection
> `ef62b782198ed6b3`) nằm ở
> `.fleetscope/sessions/fs-20260830T204924Z-98f69c07/session.jsonl`, và
> `.gitignore:27` loại bỏ toàn bộ `.fleetscope/`. Nó **chỉ tồn tại trên máy
> này**. Giám khảo clone repo về sẽ không thấy bằng chứng mà checklist đang
> viện dẫn. Trước khi nộp: hoặc commit bản đã redact vào
> `crates/fleetscope-cli/tests/fixtures/`, hoặc upload nó lên Cloud Storage và
> ghi generation. Video vẫn quay được vì file có trên máy — nhưng repo thì
> không tự chứng minh được.

---

## 1. Pitch deck — 6 slide, ~3 phút

Mỗi slide: câu mở → bằng chứng → câu chốt. Không đọc slide.

### Slide 1 — Problem (0:00–0:30)

> "Launch readiness is not a chat. It is a multi-step job: check the service,
> check the storage, check the budget, then decide. Today that job is done by a
> human reading dashboards, and when an agent does it instead, all you get back
> is a wall of JSONL. You cannot tell which agent ran, which call is still
> waiting, or whether silence means finished or dead."

**Trên slide:** bốn agent, một quyết định. Không code.

### Slide 2 — Action (0:30–1:10)

> "So we built the job as agents. Google ADK runs a SequentialAgent with four
> children. `cloud_run_probe` does one read-only `services.get`.
> `storage_probe` does one read-only `buckets.get`. `budget_guard` verifies six
> model calls, one hundred eighty seconds, two reads, zero writes. Then
> `launch_reviewer` reads all three reports and issues READY or NOT_READY.
> A seventh model call is refused before it is issued."

**Trên slide:** sơ đồ 4 agent + logo Vertex/ADK. Nhấn chữ **decision**.

### Slide 3 — Evidence (1:10–1:50)

> "FleetScope is the window on that work. It never starts an agent, never
> retries, never approves, never mutates. It reads the JSONL the producer owns
> and projects it: agent rail, parent-child graph, event inspector, timeline.
> The session log is the source of truth, and there is no second version of it."

**Trên slide:** split — producer bên trái, FleetScope bên phải, mũi tên một
chiều. Mũi tên chỉ đi một hướng: đó chính là luận điểm.

### Slide 4 — Trust (1:50–2:25)

> "Two rules are enforced at ingestion, not at render. Hidden reasoning is
> dropped before it can reach any surface. And terminal state comes only from
> what the session recorded — an agent that never reported reads *no terminal
> event recorded*, and an unanswered tool call is named as waiting. A stuck
> agent has to look stuck. We would rather show you *unknown* than show you a
> guess."

**Trên slide:** hai dòng thật từ `inspect` — `[ ] search_hotels no result
recorded` và `[no terminal event recorded]`.

### Slide 5 — Architecture (2:25–2:50)

> "Vertex AI Gemini 3.7 Flash, Google ADK two-point-eight, Cloud Run and Cloud
> Storage — one session ID across all of it. One projection core in Rust feeds
> three front ends: the terminal, the browser over WebAssembly, and a headless
> `inspect`. The terminal and the browser cannot disagree about what a session
> says, because they render the same projection."

**Trên slide:** `docs/product/fleetscope-devpost-architecture.png`.

### Slide 6 — Replay (2:50–3:10)

> "And because the evidence is a file, finished work stays debuggable. Pause,
> seek, change speed, return to the live edge — without paying for another run.
> Gemini does the work. FleetScope makes the work inspectable."

**Trên slide:** timeline + nút play/pause. Câu cuối là câu chốt — dừng ở đó.

---

## 2. Video demo — 3:50, live, không cắt

Luật: dưới 4 phút · 20 giây đầu phải nêu problem + value · phải thấy app chạy
thật · phải thấy bằng chứng Google Cloud.

### Shot 1 — Problem + value (0:00–0:20) · slide

> "Checking whether a service is ready to launch is a multi-step job, and when
> you hand it to agents you get back a wall of JSONL. FleetScope runs that job
> as four Gemini agents that issue READY or NOT_READY — and then lets you watch
> exactly how they decided."

Đúng 20 giây. Không chào, không giới thiệu tên, không "hi everyone".

### Shot 2 — Cái workflow tự quyết định (0:20–1:15) · Terminal A

```bash
pnpm demo:google-session -- \
  --project project-ac0c5f88-868b-46b9-a2e \
  --location us-central1 \
  --service fleetscope-web \
  --bucket fleetscope-sessions-project-ac0c5f88-868b-46b9-a2e
```

Không có `--run` thì đây là dry-run zero-cost: in ra kế hoạch đóng dưới dạng
JSON (`"mode": "dry-run"`), không gọi model, không chạm mạng, không ghi file.
Bốn cờ tài nguyên là **bắt buộc** — chạy trần sẽ lỗi `invalid project: ''`.

> "Without the run flag this is a zero-cost dry run. It validates the closed
> configuration and prints the exact plan — four agents, six model calls,
> two read-only Google API operations, and no writes. Spending money is an
> explicit opt-in, not a default."

Rồi mở kết quả của lần chạy thật đã ghi:

```bash
cargo run -p fleetscope-cli --bin fleetscope -- \
  inspect .fleetscope/sessions/fs-20260830T204924Z-98f69c07
```

Chỉ tay vào ba dòng đầu và đọc:

> "This is a real Vertex run. `producer google-adk 2.8.0`, model
> `gemini-3.7-flash` — and that model version is what the provider reported on
> the events, not what we configured. Five agents, fifteen events, both tool
> calls answered, zero failed events."

Cuộn tới quyết định:

> "And the reviewer's verdict: READY."

**Cấm nói:** "chúng tôi đang chạy live ngay đây" nếu đang mở file đã ghi. Nói
"a real Vertex run, recorded".

### Shot 3 — Bằng chứng Google Cloud (1:15–2:00) · Terminal B + browser

```bash
gcloud run services describe fleetscope-web --region us-central1 \
  --format="value(status.url, status.latestReadyRevisionName)"
```

In ra đúng một dòng: URL + revision. Đọc thẳng dòng đó.

> "The viewer is on Cloud Run in `us-central1`, project
> `project-ac0c5f88-868b-46b9-a2e`, revision `fleetscope-web-00001-g4s`."

**Đừng dùng `gcloud run services list`** trong video: nó in cột *LAST DEPLOYED
BY* chứa email cá nhân, và in URL ở dạng project-number
(`fleetscope-web-119741899953...`) khác với URL đã ghi trong checklist. Hai dạng
URL cùng trỏ một service, nhưng giám khảo sẽ phải tự đoán — `describe` tránh cả
hai vấn đề.

Sang browser, mở URL `.run.app`, để trang load thật trên camera.

```bash
curl -s https://fleetscope-api-6tes2q7oqa-uc.a.run.app/health
```

> "And the API answers `liveMode: false` — the deployment is recorded-only
> until a live run is explicitly opted into. The guardrail is in the deployed
> service, not in a slide."

Đây là 45 giây quan trọng nhất cho tiêu chí Cloud. Đừng vội.

### Shot 4 — FleetScope quan sát một run đang sống (2:00–2:45) · Terminal A

```bash
cargo run -p fleetscope-cli --bin fleetscope -- examples/gemini-session --follow
```

> "This is the observer following a growing session. The right edge is moving,
> so this is live follow. Four agents, and the graph shows who handed work to
> whom."

Bấm `space` để pause, `[` `]` để step, `f` để về live edge.

> "Pause. Step back through the events. Return to the edge. Same timeline, no
> second run."

### Shot 5 — Chỗ ăn điểm: sự thật thay vì suy đoán (2:45–3:30) · Terminal A

Ctrl-C rồi:

```bash
cargo run -p fleetscope-cli --bin fleetscope -- inspect examples/gemini-session
```

Chỉ vào `hotel_search`:

> "Here is the part that matters. `search_hotels` was called twice and answered
> once. The retry never returned, and the run failed with a rate limit and a
> thirty-second deadline. FleetScope does not average that away and does not
> guess — it prints *no result recorded*."

Rồi chỉ vào một agent không có terminal event:

> "And an agent that never reported its end reads *no terminal event recorded*.
> Not *completed*. We will show you unknown before we show you a guess. Hidden
> reasoning is dropped at ingestion, so nothing marked `thought` can reach this
> screen at all."

### Shot 6 — Chốt (3:30–3:50) · browser `/demo/`

Mở `https://fleetscope-web-6tes2q7oqa-uc.a.run.app/demo/`, cuộn qua bảy reading.

> "The same evidence, on Cloud Run, as seven readings of one session. Google ADK
> and Gemini make the launch decision. FleetScope proves the decision happened.
> Thanks for watching."

Dừng ghi. Xem lại trong cửa sổ ẩn danh trước khi nộp.

---

## 3. Câu trả lời cho câu hỏi khó của giám khảo

**"Cái này chỉ là log viewer thôi mà?"**

> "The viewer is the evidence surface. The product being judged is the ADK
> workflow that makes a decision — four agents, real Google API reads, a
> budget it refuses to exceed, and a READY or NOT_READY at the end. The viewer
> exists because a decision you cannot audit is not worth much."

**"Sao không dùng OpenTelemetry / Langfuse?"**

> "Those trace what the framework emits. We read the session file the producer
> already owns, so there is nothing to instrument and no second source of truth
> to keep in sync. And we deliberately do not invent the fields the format does
> not record — no token counts, no cost, no latency panels filled with
> plausible numbers."

**"Model có bịa ra không?"**

> "We separate configured from observed. `configuredModel` is what we asked
> for. Only the provider-owned `modelVersion` on the events earns the evidence
> label. In this run they happen to agree, and we still show them as two
> different things."

**"Có chạy live được không?"**

> "Yes, behind two explicit opt-ins. The deployed API reports `liveMode: false`
> by default. A metered run needs the run flag plus the spend and Vertex
> environment opt-ins inside the Python boundary."

---

## 4. Cấm nói — claim discipline

- ❌ "FleetScope launched / retried / approved / fixed it" → FleetScope **quan
  sát**, không hành động.
- ❌ Gọi file đã ghi là "live". File đang lớn = **live follow**; file đã xong =
  **replay**, kể cả khi nó đến từ một lần chạy cloud thật.
- ❌ Nói `configuredModel` như bằng chứng đã chạy.
- ❌ Nhắc CASE-1042 / Warden / Firestore / Pub/Sub — story cũ đã bỏ.
- ❌ Bịa token, cost, latency. Format không ghi thì không có.
- ❌ Để lộ API key, credential, project ID nhạy cảm, prompt riêng trên màn hình.

---

## 5. Liên quan

- [Idea and pitch](idea-and-pitch.md)
- [Submission checklist](hackathon-submission-checklist.md)

`hackathon-official.md` và `session-readings-judge-demo.md` cũng nằm trong
`docs/product/` trên máy nhưng **chưa được commit**, nên chưa link tới được từ
đây. Commit chúng rồi thêm link nếu muốn.
