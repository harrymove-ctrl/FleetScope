//! The Agent Viewer in the browser.
//!
//! A thin shell around the SAME projection and fold the `fleetscope` command
//! uses: it owns the WebGl2 terminal, the input handling, the render loop and
//! the JS-callable ABI, and nothing else. Detection, parsing, the wire emitter
//! and the fold all live in `agent-viewer-core` and `agent-viewer-render`,
//! where they are host-testable.
//!
//! That is what "browser parity" means here. It is not two frontends that were
//! tested against each other until they agreed; it is one implementation
//! neither frontend can go around. `agent_viewer_fingerprint` exists so the
//! claim can be checked from the outside rather than taken on trust.
//!
//! # What this crate does NOT do
//!
//! It does not reimplement the timeline, the graph layout, the camera, the tool
//! chips or the semantic zoom. Those are the vendored engine's, used unmodified
//! so its upstream tests keep their meaning. It also parses no provider
//! dialect: a session reaches it as text and goes straight to the shared core.

use std::cell::{Cell, RefCell};
use std::io;
use std::rc::Rc;

use agent_viewer_core::adapter::{Companion, SessionSource};
use agent_viewer_render::{Playhead, ViewState, ViewerManifest};
use ratzilla::backend::webgl2::{FontAtlasConfig, WebGl2BackendOptions};
use ratzilla::event::{
    KeyCode as RKeyCode, KeyEvent as RKeyEvent, MouseButton as RMouseButton,
    MouseEvent as RMouseEvent, MouseEventKind as RMouseKind,
};
use ratzilla::{WebGl2Backend, WebRenderer};
use wasm_bindgen::prelude::*;
use web_time::Instant;
use zoetrope::state::App;

/// The bundled demo, compiled in.
///
/// Judge-facing default: the Google ADK launch-readiness session (Cloud Run
/// probe, Storage probe, budget guard, READY decision). The travel-planner
/// fixture stays in CLI/unit tests; it is not what `/viewer` opens on.
const DEMO_SESSION: &str = include_str!(
    "../../fleetscope-cli/tests/fixtures/google-cloud-launch-readiness/session.jsonl"
);
const DEMO_NAME: &str = "google-cloud-launch-readiness/session.jsonl";

/// The DOM element the WebGl2 grid fills. `apps/web` owns everything around it
/// and writes nothing inside it, so the renderer owns its subtree entirely.
const CONTAINER: &str = "agent-viewer-canvas";
/// Rows moved per PageUp/PageDown in the detail panel.
const PAGE_SCROLL: i32 = 10;

thread_local! {
    /// The last selection the shell was told about: `(selected agent, renderer
    /// index)`. Compared after every input so a notification fires on change
    /// and not once per frame.
    static LAST_SELECTION: RefCell<Option<(Option<String>, usize)>> =
        const { RefCell::new(None) };

    /// The live viewer, shared with the render loop. The JS-callable functions
    /// below swap or mutate it in place and the next animation frame draws the
    /// change. wasm is single-threaded, so these never interleave with a frame
    /// mid-borrow.
    static VIEWER: RefCell<Option<Rc<RefCell<Viewer>>>> = const { RefCell::new(None) };
}

/// A loaded session: the folded app plus what produced it.
struct Viewer {
    app: App,
    projection: agent_viewer_core::Projection,
    /// The recorded map between viewer events and renderer items. Every
    /// identity question goes through this; nothing computes an index.
    manifest: ViewerManifest,
}

impl Viewer {
    fn load(name: &str, main: String, companions: Vec<Companion>) -> Result<Self, String> {
        let source =
            SessionSource::new(std::path::PathBuf::from(name), main).with_companions(companions);
        let projection = agent_viewer_core::project(&source).map_err(|e| e.to_string())?;
        let root_label = projection.session.root().map(|agent| agent.label.as_str());
        // Parked at the edge: a file someone just dropped is a finished
        // recording, and they opened it to see the outcome.
        let (app, manifest) = agent_viewer_render::build_with_manifest(
            &projection.wire,
            &projection.session,
            1.0,
            Playhead::Edge,
            root_label,
        );
        Ok(Self {
            app,
            projection,
            manifest,
        })
    }

    /// The status the page renders around the canvas.
    fn status(&self) -> String {
        let session = &self.projection.session;
        let value = serde_json::json!({
            "ok": true,
            "sessionId": session.session_id,
            "adapter": session.adapter_id,
            "adapterLabel": self.projection.selection.as_ref().map(|s| s.label),
            "producerVersion": self.projection.selection.as_ref().and_then(|s| s.version.clone()),
            "agents": session.agents.len(),
            "events": session.events.len(),
            "flattened": self.projection.wire.flattened,
            "flattenNote": agent_viewer_core::wire::flatten_note(&self.projection.wire),
            "fingerprint": self.projection.fingerprint(),
        });
        value.to_string()
    }
}

/// The DOM event the shell listens for.
const SELECTION_EVENT: &str = "fleetscope:viewer-selection";

/// The payload to push, if the selection changed since the last push.
///
/// # Why this is split from the dispatch
///
/// Dispatching a DOM event runs the page's listener SYNCHRONOUSLY, and that
/// listener calls straight back into the ABI to re-read the snapshot. If the
/// event were dispatched while the viewer's `RefCell` was still borrowed, that
/// re-entry would panic with "RefCell already borrowed" — which is exactly what
/// happened the first time this was written as one function. Computing the
/// payload under the borrow and dispatching after it is dropped is the whole
/// reason for the split, so do not merge them back together.
///
/// # Why no vendor change was needed
///
/// `App::selected_agent_id()` is public and the playhead is readable from the
/// timeline, so everything reported here is already observable from outside the
/// renderer. The vendored crate is untouched.
fn selection_payload(viewer: &Viewer) -> Option<String> {
    let entry_index = viewer.app.timeline.fold_target().saturating_sub(1);
    // The SESSION agent id. The renderer's private `main` must never reach the
    // shell, which would compare it against event agent ids and never match.
    let selected =
        agent_viewer_render::selected_agent(&viewer.app, viewer.manifest.root_agent_id());
    let current = (selected.clone(), entry_index);

    let changed = LAST_SELECTION.with(|cell| {
        let mut last = cell.borrow_mut();
        if last.as_ref() == Some(&current) {
            false
        } else {
            *last = Some(current);
            true
        }
    });
    if !changed {
        return None;
    }

    // The sequence comes from the manifest. A renderer item that came from no
    // viewer event reports `null`, and the shell must say so rather than
    // showing the nearest event under a wrong heading.
    Some(
        serde_json::json!({
            "selectedAgentId": selected,
            "sequence": viewer.manifest.sequence_at(entry_index),
            "rendererEntryIndex": entry_index,
        })
        .to_string(),
    )
}

/// Push a selection to the shell. MUST be called with no viewer borrow held.
fn dispatch_selection(payload: &str) {
    let Some(window) = web_sys::window() else {
        return;
    };
    let init = web_sys::CustomEventInit::new();
    init.set_detail(&JsValue::from_str(payload));
    if let Ok(event) = web_sys::CustomEvent::new_with_event_init_dict(SELECTION_EVENT, &init) {
        let _ = window.dispatch_event(&event);
    }
}

fn main() -> io::Result<()> {
    console_error_panic_hook::set_once();

    let viewer =
        Viewer::load(DEMO_NAME, DEMO_SESSION.to_owned(), Vec::new()).map_err(io::Error::other)?;
    let viewer = Rc::new(RefCell::new(viewer));
    VIEWER.with(|cell| *cell.borrow_mut() = Some(viewer.clone()));

    let last_tick = Rc::new(RefCell::new(Instant::now()));
    // Wheel events carry no grid position, so remember the last hovered cell
    // from pointer moves to anchor the zoom.
    let last_cell = Rc::new(Cell::new((0u16, 0u16)));

    // Dynamic font atlas: rasterize glyphs on demand from the browser's own
    // monospace font rather than a prebuilt static atlas, which bakes only a
    // fixed set of Unicode ranges — the status and marker glyphs would render
    // blank.
    const MONO: &[&str] = &[
        "ui-monospace",
        "SF Mono",
        "Fira Code",
        "JetBrains Mono",
        "Menlo",
        "Consolas",
        "monospace",
    ];
    let backend = WebGl2Backend::new_with_options(
        WebGl2BackendOptions::new()
            .grid_id(CONTAINER)
            .font_atlas_config(FontAtlasConfig::dynamic(MONO, 18.0))
            .canvas_padding_color(ratatui::style::Color::Indexed(255)),
    )?;
    let mut terminal = ratatui::Terminal::new(backend)?;

    let _ = terminal.on_key_event({
        let viewer = viewer.clone();
        move |key: RKeyEvent| {
            // The borrow ends with this block, before anything is dispatched.
            let payload = {
                let mut viewer = viewer.borrow_mut();
                handle_key(key, &mut viewer.app);
                selection_payload(&viewer)
            };
            if let Some(payload) = payload {
                dispatch_selection(&payload);
            }
        }
    });

    let _ = terminal.on_mouse_event({
        let viewer = viewer.clone();
        let last_cell = last_cell.clone();
        // ratzilla reports moves without button state; track press/release so a
        // drag (pan / scrubber seek) is distinguishable from a hover.
        let mut held = false;
        move |ev: RMouseEvent| {
            match ev.kind {
                RMouseKind::ButtonDown(_) => held = true,
                RMouseKind::ButtonUp(_) => held = false,
                RMouseKind::SingleClick(_)
                | RMouseKind::DoubleClick(_)
                | RMouseKind::Entered
                | RMouseKind::Exited => return,
                _ => {}
            }
            last_cell.set((ev.col, ev.row));
            let payload = {
                let mut viewer = viewer.borrow_mut();
                handle_mouse(&ev, held, &mut viewer.app);
                selection_payload(&viewer)
            };
            if let Some(payload) = payload {
                dispatch_selection(&payload);
            }
        }
    });

    install_wheel(viewer.clone(), last_cell.clone());

    terminal.draw_web({
        let viewer = viewer.clone();
        let last_tick = last_tick.clone();
        move |frame| {
            let now = Instant::now();
            let elapsed = now.duration_since(*last_tick.borrow());
            *last_tick.borrow_mut() = now;

            let mut viewer = viewer.borrow_mut();
            let historical = agent_viewer_render::snapshot(&viewer.app, &viewer.manifest).transport;
            let historical = matches!(historical, "history" | "paused");
            let app = &mut viewer.app;

            // Parked in the past, nothing is executing. The substrate's
            // presentation-time ticks drive marching-ant edges and the camera
            // glide, both of which read as "something is running right now", so
            // they are skipped and the animation phase freezes. `tick_timeline`
            // and `status_tick` still run: they advance the playhead and the
            // status line, neither of which implies live execution.
            if !historical {
                let _ = app.flow.tick_auto_pan(elapsed);
                app.flow.tick_animation(elapsed);
                app.tick_camera(elapsed);
            }
            app.tick_timeline(elapsed);
            app.status_tick();
            zoetrope::ui::draw(frame, app);
        }
    });

    Ok(())
}

// ---------------------------------------------------------------------------
// The browser ABI
//
// These are the ONLY functions apps/web may call.
// ---------------------------------------------------------------------------

fn with_viewer<T>(f: impl FnOnce(&mut Viewer) -> T) -> Option<T> {
    VIEWER.with(|cell| cell.borrow().as_ref().map(|rc| f(&mut rc.borrow_mut())))
}

/// Load a session, replacing whatever is showing.
///
/// `companions_json` is `[{"name":"subagents/x.jsonl","text":"…"}]` — the
/// per-agent files a folder selection found beside the transcript. Drag-and-drop
/// of a single file passes an empty array.
///
/// Returns the status JSON on success. Errors come back as a thrown `JsError`
/// carrying the same message the CLI would print, so a session the viewer
/// cannot read says WHY in the page rather than failing to a blank canvas.
#[wasm_bindgen]
pub fn agent_viewer_load(
    name: String,
    main: String,
    companions_json: String,
) -> Result<String, JsError> {
    let companions: Vec<Companion> = if companions_json.trim().is_empty() {
        Vec::new()
    } else {
        serde_json::from_str(&companions_json)
            .map_err(|e| JsError::new(&format!("companion list: {e}")))?
    };

    let next = Viewer::load(&name, main, companions).map_err(|e| JsError::new(&e))?;
    let status = next.status();
    with_viewer(|viewer| *viewer = next);
    Ok(status)
}

/// Reload the bundled demo. What the page opens on, and the way back.
#[wasm_bindgen]
pub fn agent_viewer_load_demo() -> Result<String, JsError> {
    agent_viewer_load(DEMO_NAME.to_owned(), DEMO_SESSION.to_owned(), String::new())
}

/// The headless summary, identical to `fleetscope inspect`.
#[wasm_bindgen]
pub fn agent_viewer_summary() -> String {
    with_viewer(|viewer| agent_viewer_core::inspect::summary(&viewer.projection))
        .unwrap_or_default()
}

/// A stable fingerprint of the compiled session.
///
/// The parity check. Two builds that produce the same fingerprint from the same
/// session are showing the same thing, and the CLI prints the same value, so
/// "native and browser agree" is verifiable rather than asserted.
#[wasm_bindgen]
pub fn agent_viewer_fingerprint() -> String {
    with_viewer(|viewer| viewer.projection.fingerprint()).unwrap_or_default()
}

/// Where the playhead sits and what that means, as JSON.
#[wasm_bindgen]
pub fn agent_viewer_snapshot() -> String {
    with_viewer(|viewer| {
        serde_json::to_string(&agent_viewer_render::snapshot(
            &viewer.app,
            &viewer.manifest,
        ))
        .unwrap_or_default()
    })
    .unwrap_or_else(|| "{}".to_owned())
}

/// The formats this build can read, as JSON. Same registry the CLI lists.
#[wasm_bindgen]
pub fn agent_viewer_formats() -> String {
    let formats: Vec<_> = agent_viewer_core::adapter::known_formats()
        .into_iter()
        .map(|(id, label)| serde_json::json!({ "id": id, "label": label }))
        .collect();
    serde_json::to_string(&formats).unwrap_or_else(|_| "[]".to_owned())
}

/// A window of the event stream, as JSON.
///
/// `{ items, totalCount, offset, hasMore }`. The slicing and the cap live in
/// `agent-viewer-core`, where they are host-testable; this is the wire.
#[wasm_bindgen]
pub fn agent_viewer_events(offset: u32, limit: u32) -> String {
    with_viewer(|viewer| {
        serde_json::to_string(
            &viewer
                .projection
                .session
                .event_window(offset as usize, limit as usize),
        )
        .unwrap_or_default()
    })
    .unwrap_or_else(|| "{\"items\":[],\"totalCount\":0,\"offset\":0,\"hasMore\":false}".to_owned())
}

/// The agent tree. Bounded by the session's agent count, which is tens even for
/// a long run, so this is deliberately not windowed.
#[wasm_bindgen]
pub fn agent_viewer_agents() -> String {
    with_viewer(|viewer| {
        serde_json::to_string(&viewer.projection.session.agent_summaries()).unwrap_or_default()
    })
    .unwrap_or_else(|| "[]".to_owned())
}

/// Move the playhead to a viewer event, by sequence.
///
/// Returns false when that event rendered nothing, which is a legitimate
/// answer the caller must handle rather than treat as an error.
///
/// `u32` on purpose: wasm-bindgen marshals a `u64` as a JavaScript BigInt, so
/// `agent_viewer_seek_sequence(9)` from JS would throw "Cannot convert 9 to a
/// BigInt" at the call site while the UI moved its cursor anyway. A sequence is
/// a dense index into one session; `u32` is ample and crosses as a number.
#[wasm_bindgen]
pub fn agent_viewer_seek_sequence(sequence: u32) -> bool {
    with_viewer(
        |viewer| match viewer.manifest.fraction_for_sequence(u64::from(sequence)) {
            Some(fraction) => {
                viewer.app.seek_to_fraction(fraction);
                true
            }
            None => false,
        },
    )
    .unwrap_or(false)
}

/// The manifest entry a renderer index rests on, as JSON, or `null`.
/// The reverse lookup: a sidecar answers with a null sequence, not a guess.
#[wasm_bindgen]
pub fn agent_viewer_item_at(renderer_entry_index: u32) -> String {
    with_viewer(|viewer| {
        viewer
            .manifest
            .entry_at(renderer_entry_index as usize)
            .and_then(|entry| serde_json::to_string(entry).ok())
            .unwrap_or_else(|| "null".to_owned())
    })
    .unwrap_or_else(|| "null".to_owned())
}

/// The nodes the graph actually has, as JSON `[{"id":…,"selected":…}]`.
///
/// This is what makes a DOM control addressable to a REAL graph node. The shell
/// renders a control only for an id that appears here, so a control can never
/// stand for a node the renderer does not have. No position or size crosses the
/// boundary: layout stays in Rust.
#[wasm_bindgen]
pub fn agent_viewer_graph_nodes() -> String {
    with_viewer(|viewer| {
        serde_json::to_string(&agent_viewer_render::graph_nodes(
            &viewer.app,
            viewer.manifest.root_agent_id(),
        ))
        .unwrap_or_default()
    })
    .unwrap_or_else(|| "[]".to_owned())
}

/// Select an agent's graph node, or deselect it when it is already selected.
///
/// Returns the renderer's answer as JSON:
/// `{"outcome":"selected"|"deselected"|"unknown","selectedAgentId":…}`. The
/// shell must render that answer rather than the id it asked for: an unknown id
/// selects nothing, and a shell that assumed otherwise would show a selection
/// the graph does not have.
///
/// Centring is a consequence of selecting, not a substitute for it. The previous
/// version of this function set `pending_center` alone, so the camera moved and
/// nothing was ever selected.
#[wasm_bindgen]
pub fn agent_viewer_select_agent(agent_id: String) -> String {
    let (answer, payload) = with_viewer(|viewer| {
        let root = viewer.manifest.root_agent_id().map(str::to_owned);
        let outcome =
            agent_viewer_render::select_agent(&mut viewer.app, root.as_deref(), &agent_id);
        let label = match outcome {
            agent_viewer_render::SelectionOutcome::Selected(_) => "selected",
            agent_viewer_render::SelectionOutcome::Deselected(_) => "deselected",
            agent_viewer_render::SelectionOutcome::Unknown => "unknown",
        };
        let answer = serde_json::json!({
            "outcome": label,
            "selectedAgentId": agent_viewer_render::selected_agent(&viewer.app, root.as_deref()),
        })
        .to_string();
        // Computed under the borrow, dispatched after it: the page's listener
        // calls straight back into this ABI, and re-entering a live borrow
        // panics.
        (answer, selection_payload(viewer))
    })
    .unwrap_or_else(|| {
        (
            r#"{"outcome":"unknown","selectedAgentId":null}"#.to_owned(),
            None,
        )
    });

    if let Some(payload) = payload {
        dispatch_selection(&payload);
    }
    answer
}

/// Clear any graph selection. Returns whether there was one to clear.
///
/// The keyboard's Escape path. Separate from `agent_viewer_select_agent` so a
/// caller can clear without naming a node it would have to know is selected.
#[wasm_bindgen]
pub fn agent_viewer_clear_selection() -> bool {
    let (had, payload) = with_viewer(|viewer| {
        let had = agent_viewer_render::clear_selection(&mut viewer.app);
        (had, selection_payload(viewer))
    })
    .unwrap_or((false, None));

    if let Some(payload) = payload {
        dispatch_selection(&payload);
    }
    had
}

/// Fit the whole graph in view, the `o` key's action.
#[wasm_bindgen]
pub fn agent_viewer_fit_graph() {
    with_viewer(|viewer| {
        viewer.app.camera = zoetrope::state::Camera::Overview;
        viewer.app.camera_glide = None;
        viewer.app.flow.request_fit_view();
    });
}

/// Everything an inspector shows for ONE event, by canonical sequence.
///
/// Returns `null` for a sequence the session does not have. That is a real
/// answer and the caller must render it as "no such event": falling back to a
/// neighbour would put real content under a wrong heading. It never throws, so
/// an inspector click cannot break the page.
///
/// Bounded by construction: one event in, one event out, whatever the session's
/// size.
#[wasm_bindgen]
pub fn agent_viewer_event_detail(sequence: u32) -> String {
    with_viewer(|viewer| {
        let sequence = u64::from(sequence);
        let Some(detail) = viewer.projection.session.event_detail(sequence) else {
            return "null".to_owned();
        };
        // The renderer items this event produced. A list because one event
        // producing several is a shape the manifest already survives.
        let indices = viewer.manifest.renderer_indices_for_sequence(sequence);
        let Ok(serde_json::Value::Object(mut map)) = serde_json::to_value(&detail) else {
            return "null".to_owned();
        };
        map.insert(
            "rendererEntryIndices".to_owned(),
            serde_json::json!(indices),
        );
        serde_json::Value::Object(map).to_string()
    })
    .unwrap_or_else(|| "null".to_owned())
}

/// The facts Story Mode renders, as JSON.
///
/// Fixed-size whatever the session's length, and it carries a capability
/// manifest so the UI can tell "this did not happen" from "this session cannot
/// record that". A local session reports every governance capability as false,
/// which is why the viewer never claims a block, a Warden retry or an
/// activation.
#[wasm_bindgen]
pub fn agent_viewer_story_facts() -> String {
    with_viewer(|viewer| {
        serde_json::to_string(&viewer.projection.session.story_facts()).unwrap_or_default()
    })
    .unwrap_or_else(|| "null".to_owned())
}

#[wasm_bindgen]
pub fn agent_viewer_go_live() {
    with_viewer(|viewer| viewer.app.go_live());
}

/// Seek to a fraction of the timeline. The scrubber's own input.
#[wasm_bindgen]
pub fn agent_viewer_seek(fraction: f64) {
    if !fraction.is_finite() {
        return;
    }
    with_viewer(|viewer| viewer.app.seek_to_fraction(fraction.clamp(0.0, 1.0)));
}

#[wasm_bindgen]
pub fn agent_viewer_toggle_play() {
    with_viewer(|viewer| viewer.app.toggle_play_pause());
}

/// Set pause without toggling. No-op when already in that state.
#[wasm_bindgen]
pub fn agent_viewer_set_paused(paused: bool) {
    with_viewer(|viewer| viewer.app.set_paused(paused));
}

/// Apply a `view.json` sidecar. Returns false for corrupt JSON (ignore once).
///
/// Writer filtering is a JS decision so both sides can apply the other's
/// writes: this applies any valid payload.
#[wasm_bindgen]
pub fn agent_viewer_apply_view(json: String) -> bool {
    let (ok, payload) = with_viewer(|viewer| {
        let Some(state) = ViewState::parse(&json) else {
            return (false, None);
        };
        state.apply(&mut viewer.app, &viewer.manifest);
        (true, selection_payload(viewer))
    })
    .unwrap_or((false, None));
    if let Some(payload) = payload {
        dispatch_selection(&payload);
    }
    ok
}

// ---------------------------------------------------------------------------
// Input — the same actions the terminal frontend binds.
// ---------------------------------------------------------------------------

fn handle_key(key: RKeyEvent, app: &mut App) {
    use zoetrope::state::Camera;

    match key.code {
        RKeyCode::Char(' ') => return app.toggle_play_pause(),
        RKeyCode::End | RKeyCode::Char('g') | RKeyCode::Char('G') => return app.go_live(),
        RKeyCode::Char('[') => return app.seek_prompt(false),
        RKeyCode::Char(']') => return app.seek_prompt(true),

        RKeyCode::Char('s') | RKeyCode::Char('S') => {
            app.timeline.compress_gaps = !app.timeline.compress_gaps;
            return;
        }

        RKeyCode::Char('o') | RKeyCode::Char('O') => {
            app.camera = Camera::Overview;
            app.camera_glide = None;
            app.flow.request_fit_view();
            return;
        }
        RKeyCode::Char('f') | RKeyCode::Char('F') => {
            app.camera = Camera::Follow;
            app.follow_inspector = true;
            app.track_activity();
            return;
        }
        RKeyCode::Char('r') | RKeyCode::Char('R') => return app.relayout_now(),

        RKeyCode::Char('i') | RKeyCode::Char('I') => {
            app.show_info = !app.show_info;
            return;
        }
        RKeyCode::Char('?') => {
            app.show_help = !app.show_help;
            return;
        }

        RKeyCode::Char('j') if scroll_detail(app, 1) => return,
        RKeyCode::Char('k') if scroll_detail(app, -1) => return,
        RKeyCode::PageDown if scroll_detail(app, PAGE_SCROLL) => return,
        RKeyCode::PageUp if scroll_detail(app, -PAGE_SCROLL) => return,

        RKeyCode::Esc => {
            app.dismiss_overlays();
            return;
        }
        _ => {}
    }

    let fk: rataflow::KeyEvent = key.clone().into();
    let response = match key.code {
        RKeyCode::Tab | RKeyCode::Up | RKeyCode::Down | RKeyCode::Left | RKeyCode::Right => {
            app.flow.handle_key_event(fk)
        }
        RKeyCode::Char('+' | '=' | '-' | '_' | '0') => app.flow.handle_controls_key_event(fk),
        RKeyCode::Char('h' | 'j' | 'k' | 'l' | 'c') => app.flow.handle_key_event(fk),
        _ => return,
    };
    let events: Vec<_> = response.into_events().collect();
    app.process_flow_events(events.into_iter());
}

/// Scroll the detail panel by `delta`. Returns true when an agent is selected
/// (key consumed); false lets it fall through to panning the graph.
fn scroll_detail(app: &mut App, delta: i32) -> bool {
    if app.selected_agent_id().is_none() {
        return false;
    }
    if delta < 0 {
        app.detail_follow = false;
    }
    app.detail_scroll = (app.detail_scroll as i32 + delta).max(0) as u16;
    true
}

/// A press or drag on the scrubber row seeks the playhead; everything else pans
/// or selects in the flow.
fn handle_mouse(ev: &RMouseEvent, held: bool, app: &mut App) {
    let pressed = matches!(ev.kind, RMouseKind::ButtonDown(RMouseButton::Left));
    let moving = !matches!(ev.kind, RMouseKind::ButtonDown(_) | RMouseKind::ButtonUp(_));

    if let Some(bar) = app.scrubber_area {
        if (pressed || (held && moving))
            && ev.row >= bar.y
            && ev.row < bar.y + bar.height
            && bar.width > 1
        {
            let rel = ev.col.saturating_sub(bar.x).min(bar.width - 1);
            // Queue rather than seek now: a drag delivers many events per frame
            // and a backward seek rebuilds the whole model, so the
            // animation-frame tick applies only the latest target.
            app.pending_seek = Some(rel as f64 / (bar.width - 1) as f64);
            return;
        }
    }

    let mut me: rataflow::MouseEvent = ev.clone().into();
    // ratzilla moves carry no button state, so synthesize the drag the flow needs.
    if held && matches!(me.kind, rataflow::MouseEventKind::Moved) {
        me.kind = rataflow::MouseEventKind::Drag(rataflow::MouseButton::Left);
    }
    let events: Vec<_> = app.flow.handle_mouse_event(me).into_events().collect();
    app.process_flow_events(events.into_iter());
}

/// Wheel → zoom at the last hovered cell. ratzilla does not surface wheel
/// through `on_mouse_event`, so listen on the container directly.
fn install_wheel(viewer: Rc<RefCell<Viewer>>, last_cell: Rc<Cell<(u16, u16)>>) {
    let Some(container) = web_sys::window()
        .and_then(|w| w.document())
        .and_then(|d| d.get_element_by_id(CONTAINER))
    else {
        return;
    };
    let closure = Closure::<dyn Fn(web_sys::WheelEvent)>::new(move |e: web_sys::WheelEvent| {
        e.prevent_default();
        if e.delta_y() == 0.0 {
            return;
        }
        let (column, row) = last_cell.get();
        let mut viewer = viewer.borrow_mut();
        let app = &mut viewer.app;
        // `handle_wheel` normalizes browser wheel frequency and deltaMode into
        // discrete zoom notches, so wasm zoom matches the native scroll feel.
        let events: Vec<_> = app
            .flow
            .handle_wheel(e.delta_y(), e.delta_mode(), column, row)
            .into_events()
            .collect();
        app.process_flow_events(events.into_iter());
    });
    let _ = container.add_event_listener_with_callback("wheel", closure.as_ref().unchecked_ref());
    closure.forget();
}
