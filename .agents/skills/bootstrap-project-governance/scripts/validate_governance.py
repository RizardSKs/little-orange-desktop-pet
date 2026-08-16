#!/usr/bin/env python3
"""Validate the structural invariants of a repository governance baseline."""

from __future__ import annotations

import argparse
import re
import sys
from collections import deque
from pathlib import Path
from urllib.parse import unquote


EXCLUDED_PARTS = {
    ".git",
    ".agents",
    ".codex",
    "node_modules",
    "dist",
    "dist-electron",
    "release",
    "coverage",
    "tmp",
}

METADATA_LABELS = {
    "document level": ("文档级别", "document level"),
    "modification permission": ("修改权限", "modification permission"),
    "applicable version": ("适用版本", "applicable version", "applicable scope"),
    "last checked": ("最后核对", "last checked"),
    "authority": ("权威来源", "权威源码", "authority source"),
    "update trigger": ("更新触发", "update trigger"),
}

LINK_PATTERN = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
PROTECTED_ENTRY_PATTERN = re.compile(r"^\s*-\s+`([^`]+\.md)`\s*$", re.IGNORECASE)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def controlled_markdown(root: Path) -> list[Path]:
    paths: list[Path] = []
    for path in root.rglob("*.md"):
        relative = path.relative_to(root)
        if any(part in EXCLUDED_PARTS for part in relative.parts):
            continue
        if relative.parts[0] == "docs" or relative.as_posix() in {
            "AGENTS.md",
            "CHANGELOG.md",
            "TECHNICAL_DESIGN.md",
            "UPDATE_GUIDE.md",
        }:
            paths.append(path)
    return sorted(paths)


def section_lines(text: str, keywords: tuple[str, ...]) -> list[str]:
    lines = text.splitlines()
    start: int | None = None
    heading_level = 0
    for index, line in enumerate(lines):
        match = re.match(r"^(#{1,6})\s+(.+)$", line)
        if not match:
            continue
        title = match.group(2).lower()
        if start is None and any(keyword in title for keyword in keywords):
            start = index + 1
            heading_level = len(match.group(1))
            continue
        if start is not None and len(match.group(1)) <= heading_level:
            return lines[start:index]
    return lines[start:] if start is not None else []


def protected_paths(path: Path) -> set[str]:
    lines = section_lines(read_text(path), ("受保护文件", "protected files"))
    return {
        match.group(1).replace("\\", "/")
        for line in lines
        if (match := PROTECTED_ENTRY_PATTERN.match(line))
    }


def relative_link_target(source: Path, raw_target: str) -> Path | None:
    target = raw_target.strip().strip("<>")
    if not target or target.startswith("#") or re.match(r"^[a-z][a-z0-9+.-]*:", target, re.I):
        return None
    target = unquote(target.split("#", 1)[0])
    if not target:
        return None
    return (source.parent / Path(target)).resolve()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repository_root", type=Path)
    args = parser.parse_args()
    root = args.repository_root.resolve()
    failures: list[str] = []

    agents = root / "AGENTS.md"
    control = root / "docs" / "governance" / "DOCUMENT_CONTROL.md"
    if not agents.is_file():
        failures.append("missing AGENTS.md")
    if not control.is_file():
        failures.append("missing docs/governance/DOCUMENT_CONTROL.md")

    markdown = controlled_markdown(root)
    for path in markdown:
        text = read_text(path)
        lowered = text.lower()
        for label, variants in METADATA_LABELS.items():
            if not any(variant.lower() in lowered for variant in variants):
                failures.append(f"{path.relative_to(root)}: missing {label}")
        for raw_target in LINK_PATTERN.findall(text):
            target = relative_link_target(path, raw_target)
            if target is not None and not target.exists():
                failures.append(f"{path.relative_to(root)}: broken link {raw_target}")

    if agents.is_file() and control.is_file():
        agents_protected = protected_paths(agents)
        control_protected = protected_paths(control)
        if not agents_protected:
            failures.append("AGENTS.md: protected-files section is empty or missing")
        if agents_protected != control_protected:
            failures.append("protected-file lists differ between AGENTS.md and DOCUMENT_CONTROL.md")
        for relative in sorted(agents_protected | control_protected):
            protected = root / relative
            if not protected.is_file():
                failures.append(f"protected file does not exist: {relative}")
            elif "LOCKED" not in read_text(protected):
                failures.append(f"protected file does not declare LOCKED: {relative}")

        graph: dict[Path, set[Path]] = {}
        markdown_set = {path.resolve() for path in markdown}
        for path in markdown:
            targets: set[Path] = set()
            for raw_target in LINK_PATTERN.findall(read_text(path)):
                target = relative_link_target(path, raw_target)
                if target in markdown_set:
                    targets.add(target)
            graph[path.resolve()] = targets

        reachable: dict[Path, int] = {agents.resolve(): 0}
        queue: deque[Path] = deque([agents.resolve()])
        while queue:
            source = queue.popleft()
            if reachable[source] >= 2:
                continue
            for target in graph.get(source, set()):
                distance = reachable[source] + 1
                if target not in reachable or distance < reachable[target]:
                    reachable[target] = distance
                    queue.append(target)
        reference_root = (root / "docs" / "reference").resolve()
        for path in markdown:
            resolved = path.resolve()
            if reference_root in resolved.parents and reachable.get(resolved, 99) > 2:
                failures.append(f"{path.relative_to(root)}: not reachable from AGENTS.md within two links")

    git_policy = root / "docs" / "governance" / "GIT_VERSION_CONTROL.md"
    if git_policy.is_file():
        text = read_text(git_policy).lower()
        for phrase in ("git", "github", "push"):
            if phrase not in text:
                failures.append(f"GIT_VERSION_CONTROL.md: missing {phrase} rule")

    release_policy = root / "docs" / "governance" / "RELEASE_AND_COMPATIBILITY.md"
    if release_policy.is_file():
        text = read_text(release_policy).lower()
        for phrase in ("github release", "setup", "update", "manifest"):
            if phrase not in text:
                failures.append(f"RELEASE_AND_COMPATIBILITY.md: missing {phrase} rule")

    if failures:
        print("Governance validation failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print(f"Governance validation passed: {len(markdown)} controlled Markdown files checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
