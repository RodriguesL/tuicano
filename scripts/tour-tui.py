#!/usr/bin/env python3
"""The end-to-end screen tour for TUIcano (docs/spec-tuicano.md §5).

`test/tuicano-tour.test.tsx` proves the routing in-process; this proves it in a real
terminal: raw mode, the alternate screen, the CSI 14 t cell probe, a daemon on a
socket, and frames read back from a pty. It is the evidence generator for the phases.

Two lessons from the ad-hoc version this replaces, both fixed here:
  * a key and the Enter after it are written in *separate* writes, with a pause in
    between: a single write of "\\x1b[B\\r" is one read for the terminal's parser, and
    the Enter can be swallowed;
  * the marker for a screen is the view the status line prints ("· usage ·"), not a
    label that also appears in the sidebar — the earlier version passed steps it had
    not actually navigated.

Hermetic: it makes its own data folder under the temp dir, starts its own daemon, and
removes both at the end. Nothing outside the temp dir is written.

Usage:
    npm run build:tui            # required first
    python3 scripts/tour-tui.py  # exits non-zero if a step fails
"""
import fcntl
import os
import pty
import re
import select
import shutil
import signal
import struct
import subprocess
import sys
import tempfile
import termios
import time

ROWS, COLS, XPIX, YPIX = 45, 110, 990, 810

# One entry per stop: what it is, the keys (each written on its own), and the view the
# status line must be showing afterwards.
TOUR = [
    ('boot: the sidebar and the default conversation', [], '· conversation ·'),
    ('the introduction is not shown (TUCANO_SEED=1)', [], '· conversation ·'),
    ('approvals, on a', ['a'], '· approvals ·'),
    ('usage, on u', ['u'], '· usage ·'),
    ('connectors, on c', ['c'], '· connectors ·'),
    ('memory, on m', ['m'], '· memory ·'),
    ('routines, on r', ['r'], '· routines ·'),
    ('skills, on k', ['k'], '· skills ·'),
    ('report, on b', ['b'], '· report ·'),
    ('settings, on ,', [','], '· settings ·'),
    ('a new agent, on g', ['g'], '· new-agent ·'),
    ('the Tuca, on t', ['t'], '· tuca ·'),
    # The overlays, and the one that regressed: the app's own handler closes the help
    # and the image viewer, so it must stay listening while they are up.
    ('the help opens, on ?', ['?'], 'docs/spec-tuicano.md'),
    ('the help closes on any key', ['x'], '? help', 'docs/spec-tuicano.md'),
    ('the theme picker, on Ctrl+T', ['\x14'], '╔'),
    ('the theme picker closes on Esc', ['\x1b'], '? help', '╔'),
    ('back to a conversation, on 1', ['1'], '· conversation ·'),

]

ANSI = re.compile(rb'\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\x1b[()][A-Z0-9]|\x1b[=>]|[\x00-\x08\x0b-\x1f]')


def strip(data: bytes) -> str:
    return ANSI.sub(b'', data).replace(b'\r', b'\n').decode('utf8', 'replace')


def main() -> int:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    entry = os.path.join(root, 'out', 'tuicano', 'index.js')
    if not os.path.exists(entry):
        print('tour: out/tuicano/index.js is missing. Build it first: npm run build:tui', file=sys.stderr)
        return 2

    data = tempfile.mkdtemp(prefix='tuicano-tour-')
    env = dict(
        os.environ,
        TUCANO_DATA=data,
        TUCANO_FAKE_ENGINES='1',
        # The sample team, so there is something on every screen. Without it the client
        # correctly starts empty and asks the first question of the introduction.
        TUCANO_SEED='1',
        TERM='xterm-256color',
        # The tour's markers are the status line's words, and the client speaks the
        # workspace's language (Portuguese by default), so the tour pins it to English.
        # The other side is covered by test/tuicano-language.test.tsx.
        TUCANO_LOCALE='en',
    )
    daemon = None
    pid = None
    fd = None
    failures: list[str] = []
    try:
        daemon = subprocess.Popen(['node', entry, 'daemon'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=root)
        time.sleep(6)  # SQLite, the harness detection, the MCP gateway, the socket

        pid, fd = pty.fork()
        if pid == 0:
            os.environ.update(env)
            os.chdir(root)
            os.execvpe('node', ['node', entry], os.environ)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', ROWS, COLS, XPIX, YPIX))

        out = bytearray()
        answered = False

        def pump(seconds: float) -> None:
            nonlocal answered
            end = time.time() + seconds
            while time.time() < end:
                ready, _, _ = select.select([fd], [], [], 0.05)
                if not ready:
                    continue
                try:
                    chunk = os.read(fd, 65536)
                except OSError:
                    return
                if not chunk:
                    return
                out.extend(chunk)
                # Answer the cell probe, as a terminal would, so the client's sizing
                # path is exercised rather than falling back.
                if not answered and b'\x1b[14t' in bytes(out):
                    os.write(fd, b'\x1b[4;%d;%dt' % (YPIX, XPIX))
                    answered = True

        pump(8)
        for step in TOUR:
            label, keys, marker = step[0], step[1], step[2]
            absent = step[3] if len(step) > 3 else None
            watched = marker
            # What is drawn from this key on: an assertion that something closed must
            # not be satisfied (or defeated) by a frame from before the key.
            start = 0 if not keys else len(out)
            for key in keys:
                os.write(fd, key.encode())
                pump(0.3)  # a key and the next one are separate reads, never one write
            pump(1.2)
            frame = strip(bytes(out[start:]))
            ok = watched in frame and (absent is None or absent not in frame)
            print(f'{"ok  " if ok else "MISS"} {label}  (expected {watched!r}' + (f', no {absent!r})' if absent else ')'))
            if not ok:
                failures.append(label)
                tail = [line for line in frame.split('\n') if line.strip()][-3:]
                print('     the frame ended with: ' + ' | '.join(tail))
        print('---')
        print('failures:', failures if failures else 'none')
        return 1 if failures else 0
    finally:
        if fd is not None:
            try:
                os.write(fd, b'q')
            except OSError:
                pass
        if pid:
            try:
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        if daemon:
            daemon.terminate()
            daemon.wait(timeout=10)
        shutil.rmtree(data, ignore_errors=True)
        print(f'tour: removed {data}')


if __name__ == '__main__':
    sys.exit(main())
