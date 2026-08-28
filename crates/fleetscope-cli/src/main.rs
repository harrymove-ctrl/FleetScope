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

    <path> is a session file or a directory containing one. A directory opens
    the most recently modified session found in it or one level below.

OPTIONS
    -f, --follow        open parked at the live edge instead of replaying
    -s, --speed <N>     replay speed multiplier (default 1)
    -h, --help          print this message
    -V, --version       print the version

IN THE VIEWER
    space  play/pause      ←/→  step        g/G  start/end
    o      overview        f    follow      ?    help        q  quit

The viewer reads local files only. It starts no agent, sends nothing over the
network, and needs no API key.
";

#[derive(Debug)]
enum Command {
    View {
        path: PathBuf,
        follow: bool,
        speed: f64,
    },
    Inspect {
        path: PathBuf,
    },
    Help,
    Version,
}

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
        Command::Inspect { path } => match run_inspect(&path) {
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
        } => match run_view(&path, follow, speed) {
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
    if args[0] == "inspect" {
        inspect = true;
        rest = &args[1..];
    }

    let mut path: Option<PathBuf> = None;
    let mut follow = false;
    let mut speed = 1.0_f64;

    let mut index = 0;
    while index < rest.len() {
        let argument = rest[index].as_str();
        match argument {
            "-h" | "--help" => return Ok(Command::Help),
            "-V" | "--version" => return Ok(Command::Version),
            "-f" | "--follow" => follow = true,
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
        Ok(Command::Inspect { path })
    } else {
        Ok(Command::View {
            path,
            follow,
            speed,
        })
    }
}

fn run_inspect(path: &std::path::Path) -> Result<String, Box<dyn std::error::Error>> {
    let resolved = discover::resolve(path)?;
    let loaded = fleetscope_cli::load(&resolved)?;
    Ok(inspect::summary(&loaded.session, &loaded.wire))
}

fn run_view(
    path: &std::path::Path,
    follow: bool,
    speed: f64,
) -> Result<(), Box<dyn std::error::Error>> {
    let resolved = discover::resolve(path)?;
    let loaded = fleetscope_cli::load(&resolved)?;

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
    let app = scene::build(&loaded.wire, speed, playhead, root_label);

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

        zoetrope::tui::run(app, tail_tx, ui_rx).await
    })?;

    Ok(())
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
