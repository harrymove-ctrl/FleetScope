//! `fleetscope` — the Agent Viewer command.
//!
//! Launch options only choose the initial target and the initial playhead. Once
//! the viewer is running the same actions are always available: follow live,
//! replay, pause, resume, seek, and return to live. Transport state is derived
//! from the playhead and the live edge, never from a mode flag captured at
//! startup, so nothing here can put the viewer into a state the keyboard cannot
//! get out of.

use std::path::PathBuf;
use std::process::ExitCode;

use fleetscope_cli::scene::Playhead;
use fleetscope_cli::{discover, inspect, scene};
use tokio::sync::mpsc;

const USAGE: &str = "\
fleetscope — local Agent Viewer for Gemini/ADK multi-agent sessions

USAGE
    fleetscope <path> [options]        open the viewer
    fleetscope inspect <path>          print a headless summary
    fleetscope demo [--open]           show the local demo surfaces

    <path> is a session file or a directory containing one. A directory opens
    the most recently modified session found in it or one level below.

OPTIONS
    -f, --follow        open parked at the live edge instead of replaying
    -s, --speed <N>     replay speed multiplier (default 1)
        --format <ID>   force a session format instead of detecting one
        --formats       list the session formats this build can read
        --tiny          skip the size warning on a terminal smaller than 160×48
    -h, --help          print this message
    -V, --version       print the version

IN THE VIEWER
    space  pause           [ / ]  step      g    live edge
    o      overview        f      follow    esc  close panel
    ?      help            q      quit

The viewer reads local files only. It starts no agent, sends nothing over the
network, and needs no API key.
";

#[derive(Debug)]
enum Command {
    View {
        path: PathBuf,
        follow: bool,
        speed: f64,
        format: Option<String>,
        tiny: bool,
    },
    Inspect {
        path: PathBuf,
        format: Option<String>,
    },
    /// The formats this build can read. Printed on request and named in the
    /// error when detection refuses a file, so "unsupported" is always
    /// actionable rather than a dead end.
    Formats,
    /// Point the operator at the local demo surfaces.
    ///
    /// It prints where to look and, with `--open`, opens the viewer. It does
    /// NOT start a run: starting one spends money and reaches the internet, and
    /// that control is a loopback-only action on the local API. A CLI flag that
    /// silently began spending would be exactly the wrong affordance.
    Demo {
        open: bool,
        url: String,
    },
    Help,
    Version,
}

/// Where the local viewer is served during development.
const DEFAULT_DEMO_URL: &str = "http://localhost:59541/viewer";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let command = match parse(&args) {
        Ok(command) => command,
        Err(message) => {
            eprintln!("fleetscope: {message}\n\n{USAGE}");
            return ExitCode::FAILURE;
        }
    };

    match command {
        Command::Help => {
            print!("{USAGE}");
            ExitCode::SUCCESS
        }
        Command::Version => {
            println!("fleetscope {}", env!("CARGO_PKG_VERSION"));
            ExitCode::SUCCESS
        }
        Command::Demo { open, url } => {
            print!("{}", demo_banner(&url));
            if open {
                match open_in_browser(&url) {
                    Ok(()) => println!("Opened {url}"),
                    Err(error) => {
                        // Say why rather than exiting silently: the URL is
                        // printed above and remains usable by hand.
                        eprintln!("fleetscope: could not open a browser ({error}). Open {url}");
                        return ExitCode::FAILURE;
                    }
                }
            }
            ExitCode::SUCCESS
        }
        Command::Formats => {
            for (id, label) in fleetscope_cli::adapter::known_formats() {
                println!("{id:<18} {label}");
            }
            ExitCode::SUCCESS
        }
        Command::Inspect { path, format } => match run_inspect(&path, format.as_deref()) {
            Ok(text) => {
                print!("{text}");
                ExitCode::SUCCESS
            }
            Err(error) => {
                eprintln!("fleetscope: {error}");
                ExitCode::FAILURE
            }
        },
        Command::View {
            path,
            follow,
            speed,
            format,
            tiny,
        } => match run_view(&path, follow, speed, format.as_deref(), tiny) {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => {
                eprintln!("fleetscope: {error}");
                ExitCode::FAILURE
            }
        },
    }
}

fn parse(args: &[String]) -> Result<Command, String> {
    if args.is_empty() {
        return Ok(Command::Help);
    }

    let mut rest = args;
    let mut inspect = false;
    if args[0] == "demo" {
        let mut open = false;
        let mut url = DEFAULT_DEMO_URL.to_string();
        let mut index = 1;
        while index < args.len() {
            match args[index].as_str() {
                "--open" => open = true,
                "--url" => {
                    index += 1;
                    url = args
                        .get(index)
                        .ok_or_else(|| "--url needs an address".to_string())?
                        .clone();
                }
                "-h" | "--help" => return Ok(Command::Help),
                other => return Err(format!("unknown option {other:?}")),
            }
            index += 1;
        }
        return Ok(Command::Demo { open, url });
    }
    if args[0] == "inspect" {
        inspect = true;
        rest = &args[1..];
    }

    let mut path: Option<PathBuf> = None;
    let mut follow = false;
    let mut speed = 1.0_f64;
    let mut format: Option<String> = None;
    let mut tiny = false;

    let mut index = 0;
    while index < rest.len() {
        let argument = rest[index].as_str();
        match argument {
            "-h" | "--help" => return Ok(Command::Help),
            "-V" | "--version" => return Ok(Command::Version),
            "--formats" => return Ok(Command::Formats),
            "-f" | "--follow" => follow = true,
            "--tiny" => tiny = true,
            "--format" => {
                index += 1;
                let value = rest
                    .get(index)
                    .ok_or_else(|| "--format needs a format id".to_string())?;
                format = Some(value.clone());
            }
            "-s" | "--speed" => {
                index += 1;
                let value = rest
                    .get(index)
                    .ok_or_else(|| "--speed needs a number".to_string())?;
                speed = value
                    .parse::<f64>()
                    .map_err(|_| format!("--speed expects a number, got {value:?}"))?;
                if !(speed.is_finite() && speed > 0.0) {
                    return Err(format!("--speed must be greater than 0, got {speed}"));
                }
            }
            other if other.starts_with('-') => {
                return Err(format!("unknown option {other:?}"));
            }
            other => {
                if path.is_some() {
                    return Err(format!("unexpected extra argument {other:?}"));
                }
                path = Some(PathBuf::from(other));
            }
        }
        index += 1;
    }

    let path = path.ok_or_else(|| "a session path is required".to_string())?;
    if inspect {
        Ok(Command::Inspect { path, format })
    } else {
        Ok(Command::View {
            path,
            follow,
            speed,
            format,
            tiny,
        })
    }
}

/// What the demo command prints.
///
/// It deliberately does not restate the scenario's budget or target. Those live
/// in the run controller's allowlist, in one place, and the capability endpoint
/// reports them; copying them here would create a second source of truth that
/// drifts.
fn demo_banner(url: &str) -> String {
    format!(
        "FleetScope\n\
         Local agent session viewer and run control\n\
         \n\
         \x20 viewer      {url}\n\
         \x20 capability  GET /runs/capability on the local API\n\
         \x20 start a run POST /runs, loopback only, one fixed scenario\n\
         \n\
         This command opens the viewer. It does not start a run: starting one\n\
         spends model calls and performs an external read, so it stays an\n\
         explicit action on the local API rather than a CLI flag.\n"
    )
}

/// Ask the desktop to open a URL. No browser is bundled or assumed.
fn open_in_browser(url: &str) -> Result<(), String> {
    // Only a http(s) URL is ever passed to the shell helper, so a crafted
    // argument cannot become a command.
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err(format!("refusing to open a non-http URL: {url}"));
    }
    let program = if cfg!(target_os = "macos") {
        "open"
    } else if cfg!(target_os = "windows") {
        "explorer"
    } else {
        "xdg-open"
    };
    std::process::Command::new(program)
        .arg(url)
        .status()
        .map_err(|error| error.to_string())
        .and_then(|status| {
            if status.success() {
                Ok(())
            } else {
                Err(format!("{program} exited with {status}"))
            }
        })
}

fn run_inspect(
    path: &std::path::Path,
    format: Option<&str>,
) -> Result<String, Box<dyn std::error::Error>> {
    let resolved = discover::resolve(path)?;
    let loaded = load(&resolved, format)?;
    Ok(inspect::summary(&loaded))
}

/// Project a resolved file, honouring an explicit `--format`.
fn load(
    path: &std::path::Path,
    format: Option<&str>,
) -> Result<fleetscope_cli::Projection, Box<dyn std::error::Error>> {
    match format {
        None => fleetscope_cli::load(path),
        Some(id) => {
            let source = discover::read_source(path)?;
            Ok(agent_viewer_core::project_as(&source, id)?)
        }
    }
}

fn run_view(
    path: &std::path::Path,
    follow: bool,
    speed: f64,
    format: Option<&str>,
    tiny: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(message) = size_gate(tiny) {
        // Typical macOS windows are under 160×48. Zoetrope already lays out to
        // the real size; refusing to start made Copy CLI unusable.
        eprintln!("{message}");
    }

    let resolved = discover::resolve(path)?;
    let loaded = load(&resolved, format)?;

    // A directory means "show me whatever is happening", which is the live
    // edge. An explicit file means "replay this", which starts at the top.
    // `--follow` overrides either way. This is the ONLY thing the launch
    // options decide; every transport action stays available afterwards.
    let playhead = if follow || path.is_dir() {
        Playhead::Edge
    } else {
        Playhead::Start
    };

    let root_label = loaded.session.root().map(|agent| agent.label.as_str());
    let (app, manifest) =
        scene::build_with_manifest(&loaded.wire, &loaded.session, speed, playhead, root_label);
    let pairing_dir = fleetscope_cli::view_state::session_dir(path, &resolved);

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?;

    runtime.block_on(async move {
        // The renderer's loop holds a request sender to keep its channel open.
        // Nothing sends on it here: session switching is not a phase 1 action.
        let (tail_tx, _tail_rx) = mpsc::channel(1);
        let (ui_tx, ui_rx) = mpsc::channel(256);

        // Tailing is always on, even for a finished recording. A file that
        // never grows simply never produces a batch, and a recording that turns
        // out to be live keeps working without the developer relaunching.
        tokio::spawn(follow::watch_task(resolved, ui_tx));

        let pairing = fleetscope_cli::view_state::Pairing::new(pairing_dir, manifest);
        zoetrope::tui::run_with(app, tail_tx, ui_rx, pairing).await
    })?;

    Ok(())
}

/// Warn on a cramped TTY. Never refuse: `--tiny` only silences the notice.
///
/// `inspect` / `demo` / `--help` never call this. A pipe has no size to judge.
fn size_gate(tiny: bool) -> Option<String> {
    use std::io::IsTerminal;
    if tiny || !std::io::stdin().is_terminal() {
        return None;
    }
    let (cols, rows) = crossterm::terminal::size().ok()?;
    if cols >= 160 && rows >= 48 {
        return None;
    }
    Some(format!(
        "fleetscope: terminal is {cols}×{rows} (full layout is 160×48). Continuing with a compact view."
    ))
}

mod follow {
    use std::path::PathBuf;

    use tokio::sync::mpsc;
    use zoetrope::tailer::UiEvent;

    /// Thin wrapper so `main` does not have to know the watcher's flags.
    pub async fn watch_task(path: PathBuf, tx: mpsc::Sender<UiEvent>) {
        fleetscope_cli::follow::watch(path, tx, true).await;
    }
}
