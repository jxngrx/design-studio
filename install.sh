#!/usr/bin/env bash
# Design Studio installer: puts the app in ~/.design-studio and the Claude skill in ~/.claude/skills/design-studio
# Overrides: DESIGN_STUDIO_HOME, CLAUDE_SKILLS_DIR, DESIGN_STUDIO_REPO
set -euo pipefail
REPO="${DESIGN_STUDIO_REPO:-https://github.com/jxngrx/design-studio.git}"
DIR="${DESIGN_STUDIO_HOME:-$HOME/.design-studio}"
SKILL_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}/design-studio"

command -v git  >/dev/null || { echo "git is required"  >&2; exit 1; }
command -v node >/dev/null || { echo "Node.js 16.7+ is required (18+ recommended): https://nodejs.org" >&2; exit 1; }
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 16 ] || { echo "Node.js 16.7+ is required (18+ recommended)" >&2; exit 1; }

if [ -d "$DIR/.git" ]; then echo "Updating $DIR"; git -C "$DIR" pull --ff-only
else echo "Installing to $DIR"; git clone --depth 1 "$REPO" "$DIR"; fi

mkdir -p "$SKILL_DIR"
cp "$DIR/skills/design-studio/SKILL.md" "$SKILL_DIR/SKILL.md"

cat <<MSG

Design Studio is installed.
  App:    $DIR
  Skill:  $SKILL_DIR/SKILL.md

Restart Claude Code, then run /design-studio (or describe a UI you want to design).
Or start it yourself:  cd "$DIR" && node server.mjs   ->  http://localhost:4400
MSG
