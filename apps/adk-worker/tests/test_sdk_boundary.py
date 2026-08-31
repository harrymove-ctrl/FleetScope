import ast
import subprocess
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src"

# Everything the API and the recorded demo depend on. None of it may need the
# vendor SDK, because that is what makes the whole contract testable at zero
# cost and keeps the vendor's event shape out of FleetScope's evidence.
SDK_FREE = [
    "fleetscope_worker",
    "fleetscope_worker.contract",
    "fleetscope_worker.faults",
    "fleetscope_worker.tools",
    "fleetscope_worker.capture",
    "fleetscope_worker.recovery",
    "fleetscope_worker.session",
    "fleetscope_worker.transport",
    "fleetscope_worker.main",
]


def test_the_core_modules_do_not_import_the_vendor_sdk():
    # Asserted in a fresh interpreter: checking sys.modules in-process would
    # pass simply because a sibling test imported the SDK first.
    program = (
        "import sys\n"
        f"sys.path.insert(0, {str(SRC)!r})\n"
        f"for name in {SDK_FREE!r}:\n"
        "    __import__(name)\n"
        "leaked = [m for m in sys.modules if m.split('.')[0] == 'google']\n"
        "print('LEAK' if leaked else 'CLEAN')\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", program], capture_output=True, text=True, check=True
    )
    assert result.stdout.strip() == "CLEAN", result.stdout


#: The only modules permitted to import the vendor SDK.
SDK_MODULES = {"agents.py", "adk_runtime.py", "google_session.py"}


def test_only_the_declared_modules_import_the_sdk():
    # Parsed, not grepped: a docstring that says "does not import google.adk" is
    # documentation, and a test that cannot tell the two apart would punish the
    # comment that explains the rule.
    offenders = []
    for path in (SRC / "fleetscope_worker").glob("*.py"):
        if path.name in SDK_MODULES:
            continue
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                names = [node.module or ""]
            else:
                continue
            if any(name.split(".")[0] == "google" for name in names):
                offenders.append(f"{path.name}:{node.lineno}")
    assert offenders == [], f"these modules import the SDK outside {sorted(SDK_MODULES)}: {offenders}"


def test_main_reaches_the_runtime_without_importing_the_sdk():
    # `main` selects the ADK runtime lazily. If that import ever moves to module
    # scope, importing the worker at all would require the SDK, and the zero-cost
    # contract tests would stop being zero-cost.
    assert "adk_runtime" not in [
        node.module
        for node in ast.walk(ast.parse((SRC / "fleetscope_worker" / "main.py").read_text()))
        if isinstance(node, ast.ImportFrom) and node.col_offset == 0
    ]


def test_the_agents_module_is_not_reachable_from_the_package_root():
    # `import fleetscope_worker` must stay SDK-free, so the API can depend on the
    # contract without the SDK being installed at all.
    root = (SRC / "fleetscope_worker" / "__init__.py").read_text()
    assert "agents" not in [
        alias.name
        for node in ast.walk(ast.parse(root))
        if isinstance(node, ast.ImportFrom)
        for alias in node.names
    ]
