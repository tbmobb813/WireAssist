#!/usr/bin/env python3
"""Create the WireAssist roadmap issues from wireassist-issues.md.

Usage:
  python3 create_issues.py --dry-run        # preview only, creates nothing
  python3 create_issues.py                  # create labels + issues (needs `gh auth login`)
"""
import subprocess
import sys
from pathlib import Path

REPO = "tbmobb813/WireAssist"
SRC = Path(__file__).with_name("wireassist-issues.md")
DRY = "--dry-run" in sys.argv

LABEL_COLORS = {
    "security": "b60205",
    "bug": "d73a4a",
    "ux": "1d76db",
    "mobile": "0e8a16",
    "enhancement": "a2eeef",
    "integrations": "5319e7",
    "analytics": "fbca04",
    "content": "c5def5",
    "onboarding": "bfd4f2",
    "learning": "d4c5f9",
    "tier-0": "b60205",
    "tier-1": "e99695",
    "tier-2": "f9d0c4",
}


def parse(text):
    issues = []
    for chunk in text.split("=== ISSUE ===")[1:]:
        head, body = chunk.split("body:", 1)
        meta = {}
        for line in head.strip().splitlines():
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
        issues.append(
            {
                "title": meta["title"],
                "labels": [l for l in meta["labels"].split(",") if l],
                "body": body.strip() + "\n",
            }
        )
    return issues


def run(cmd):
    print("+", " ".join(cmd[:6]), "..." if len(cmd) > 6 else "")
    if not DRY:
        subprocess.run(cmd, check=False)


def main():
    issues = parse(SRC.read_text())
    print(f"Parsed {len(issues)} issues from {SRC.name}\n")
    used = sorted({l for i in issues for l in i["labels"]})
    for label in used:
        run(["gh", "label", "create", label, "--repo", REPO,
             "--color", LABEL_COLORS.get(label, "ededed"), "--force"])
    for n, issue in enumerate(issues, 1):
        print(f"\n[{n}/{len(issues)}] {issue['title']}  labels={issue['labels']}")
        cmd = ["gh", "issue", "create", "--repo", REPO,
               "--title", issue["title"], "--body", issue["body"]]
        for label in issue["labels"]:
            cmd += ["--label", label]
        run(cmd)


if __name__ == "__main__":
    main()
