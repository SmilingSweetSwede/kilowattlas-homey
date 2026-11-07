#!/usr/bin/env python3
"""Everything the Homey CLI packages must be readable source kept in this repository.

Run by .github/workflows/validate.yml on every push, and by hand before a
release:

    python3 scripts/check_shipped_source.py

It fails when a shipped file (the app at the repository root, the simulator
in sim/, the HomeyScript probes) is

* generated or minified: a build header ("Generated", "Do not edit", a
  source map), or a line far longer than anyone writes by hand;
* built with a frontend framework or a bundler (Svelte, React, Vue, webpack,
  Vite, rollup, esbuild): the settings page is plain HTML and JS, and a
  framework means a build step whose input is somewhere else;
* pointing at another repository as its source (a sibling checkout such as
  map_framework_2, a relative path above this repository);

or when a bundler or TypeScript configuration exists anywhere in the
repository. package.json is allowed: a Homey app needs one, and the CLI
packages its runtime dependencies from it.

Athom's reviewers and anyone installing the app must be able to read, and
rebuild, what runs on their Homey from what is in this repository.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Directories whose contents end up on a Homey, or in a user's HomeyScript.
SHIPPED_DIRS = ["lib", "drivers", "settings", "assets", "locales", "sim", "homeyscript"]
SHIPPED_FILES = ["app.js"]

# Code wider than this on one line is machine output, not source.
MAX_LINE = 1000

FORBIDDEN = [
    (r"^\s*(//|/\*|#|\*)\s*generated\b", "a build header: generated files are not source"),
    (r"do not edit", "a build header: the editable source is somewhere else"),
    (r"sourceMappingURL", "a source map: the file is compiled output"),
    (r"\bsvelte\b", "a frontend framework: Homey settings pages are plain HTML and JS"),
    (r"\breact(-dom)?\b", "a frontend framework: Homey settings pages are plain HTML and JS"),
    (r"\bvue(js)?\b", "a frontend framework: Homey settings pages are plain HTML and JS"),
    (r"\bwebpack\b|\bvite\b|\brollup\b|\besbuild\b", "a bundler: there is no build step in this repository"),
    (r"map_framework", "the private web app: nothing here may depend on it"),
    (r"\.\./\.\./\.\./", "a path above this repository: nothing here may depend on it"),
]

TOOLCHAIN = [
    "tsconfig.json",
    "vite.config.*",
    "webpack.config.*",
    "rollup.config.*",
    "svelte.config.*",
    "esbuild.config.*",
]

TEXT_SUFFIXES = {".js", ".mjs", ".cjs", ".css", ".html", ".json", ".md", ".txt", ".svg"}
SKIP_DIRS = {".git", "node_modules", ".homeybuild", "__pycache__"}


def check_file(path: Path) -> list[str]:
    problems: list[str] = []
    rel = path.relative_to(ROOT)
    text = path.read_text(encoding="utf-8", errors="replace")
    code = path.suffix in {".js", ".mjs", ".cjs", ".css", ".html"}
    if code:
        for number, line in enumerate(text.splitlines(), 1):
            if len(line) > MAX_LINE:
                problems.append(f"{rel}:{number}: line is {len(line)} characters: minified or generated output")
                break
    for pattern, why in FORBIDDEN:
        if not code and ("framework" in why or "bundler" in why):
            continue
        for number, line in enumerate(text.splitlines(), 1):
            if re.search(pattern, line, re.IGNORECASE):
                problems.append(f"{rel}:{number}: {why}\n    {line.strip()[:120]}")
                break
    return problems


def shipped_paths() -> list[Path]:
    paths: list[Path] = []
    for name in SHIPPED_FILES:
        p = ROOT / name
        if p.is_file():
            paths.append(p)
    for name in SHIPPED_DIRS:
        d = ROOT / name
        if not d.is_dir():
            continue
        for p in sorted(d.rglob("*")):
            if p.is_file() and p.suffix in TEXT_SUFFIXES and not (SKIP_DIRS & set(p.parts)):
                paths.append(p)
    return paths


def main() -> int:
    problems: list[str] = []
    for path in shipped_paths():
        problems.extend(check_file(path))
    for pattern in TOOLCHAIN:
        for path in ROOT.rglob(pattern):
            if SKIP_DIRS & set(path.parts):
                continue
            problems.append(f"{path.relative_to(ROOT)}: a build toolchain: this repository ships source only")
    if problems:
        print("Shipped files must be plain source kept in this repository:\n")
        print("\n".join(problems))
        print(f"\n{len(problems)} problem(s). See scripts/check_shipped_source.py for the rules.")
        return 1
    print("All shipped files are plain source kept in this repository.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
