#!/bin/sh
# Install TUIcano, the terminal client (docs/spec-tuicano.md §1.5).
#
# It puts one launcher on your PATH pointing back at this checkout, so `tuicano`
# works from anywhere and `git pull` is the update. The client itself is bundled to
# out/tuicano, which is what the launcher runs; its runtime dependencies (ink,
# react, the MCP SDK) come from this checkout's node_modules, so the checkout stays
# where it is.
#
#   sh scripts/install-tui.sh                 # into ~/.local/bin
#   sh scripts/install-tui.sh --prefix /usr/local
#   sh scripts/install-tui.sh --copy          # copy the launcher instead of linking
#   sh scripts/install-tui.sh --skip-build    # use whatever is already built
#   sh scripts/install-tui.sh --uninstall
set -eu

PREFIX="${PREFIX:-$HOME/.local}"
LINK=1
BUILD=1
UNINSTALL=0

while [ $# -gt 0 ]; do
  case "$1" in
    --prefix) PREFIX="$2"; shift 2 ;;
    --prefix=*) PREFIX="${1#--prefix=}"; shift ;;
    --copy) LINK=0; shift ;;
    --skip-build) BUILD=0; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    -h|--help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "install-tui: unknown option $1" >&2; exit 2 ;;
  esac
done

ROOT=$(cd "$(dirname "$0")/.." && pwd)
BIN="$PREFIX/bin"
TARGET="$BIN/tuicano"

if [ "$UNINSTALL" = 1 ]; then
  rm -f "$TARGET"
  echo "install-tui: removed $TARGET"
  echo "The checkout is untouched; its data folder (see 'tuicano --graphics-info') is yours to keep or delete."
  exit 0
fi

command -v node >/dev/null 2>&1 || { echo "install-tui: node is not on your PATH. Install Node 22 or later first." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "install-tui: npm is not on your PATH." >&2; exit 1; }
MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$MAJOR" -ge 22 ] || { echo "install-tui: Node 22 or later is required (found $(node -v)); Ink, the renderer, needs it." >&2; exit 1; }

if [ ! -d "$ROOT/node_modules" ]; then
  echo "install-tui: installing the checkout's dependencies (first run)"
  (cd "$ROOT" && npm install --no-audit --no-fund)
fi

if [ "$BUILD" = 1 ]; then
  echo "install-tui: building the client"
  (cd "$ROOT" && npm run build:tui)
fi

[ -f "$ROOT/out/tuicano/index.js" ] || { echo "install-tui: $ROOT/out/tuicano/index.js is missing and --skip-build was given. Run 'npm run build:tui'." >&2; exit 1; }

mkdir -p "$BIN"
chmod +x "$ROOT/bin/tuicano"
if [ "$LINK" = 1 ]; then
  ln -sf "$ROOT/bin/tuicano" "$TARGET"
else
  cp "$ROOT/bin/tuicano" "$TARGET"
  chmod +x "$TARGET"
fi

echo "install-tui: $TARGET -> $ROOT"
"$TARGET" --version >/dev/null 2>&1 && echo "install-tui: $( "$TARGET" --version ) works." || { echo "install-tui: installed, but running it failed. Try '$TARGET --graphics-info'." >&2; exit 1; }

case ":$PATH:" in
  *":$BIN:"*) ;;
  *) echo ""
     echo "install-tui: $BIN is not on your PATH. Add it, then open a new shell:"
     echo "  echo 'export PATH=\"$BIN:\$PATH\"' >> ~/.zshrc   # or ~/.bashrc"
     ;;
esac

echo ""
echo "Start it with: tuicano            (it starts a daemon on your data folder)"
echo "See where it will live with: tuicano --graphics-info"
