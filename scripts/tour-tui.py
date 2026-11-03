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
TOUR_CLEAN = [
    # A fresh folder: the client asks the first question of the introduction, and
    # nothing of the sample team is anywhere.
    ('clean start: the introduction', [], 'What should the agents call you'),
    ('and no sample team', [], 'step 1 of 5', 1.5, '@lia'),
    ('the help opens over it', ['?'], 'TUIcano', 1.5),
    ('and closes again', ['x'], 'Enter continue', 1.5, 'docs/spec-tuicano.md'),
    # The introduction used to restart at step one whenever it opened its own prompt,
    # because the overlay replaced the body and unmounted the screen under it: confirming
    # the name looked like nothing happening. Two Enters walk it forward.
    ('the intro opens its name prompt', ['\r'], 'Your name', 2.5),
    # Confirming it must move the wizard on to step 2, the harnesses (a fresh install
    # has none picked yet, so it waits there), and the name prompt has to be gone. The
    # wizard's own step line sits behind the modal, so this checks what is drawn.
    ('confirming the name walks on to the harnesses', ['\r'], 'log in', 2.5),
]

TOUR_SEEDED = [
    ('boot: the sidebar and the default conversation', [], '· conversation ·'),
    ('no introduction when the team exists', [], '· conversation ·', 1.0, 'Welcome to Tucano'),
    ('the help opens, on ?', ['?'], 'docs/spec-tuicano.md'),
    ('the help closes on any key', ['x'], '? help', 'docs/spec-tuicano.md'),
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
    ('the theme picker, on Ctrl+T', ['\x14'], '╔'),
    ('the theme picker closes on Esc', ['\x1b'], '? help', '╔'),
    ('talk to a channel, on 1', ['1'], '· conversation ·'),
    # One key goes back a screen, from anywhere: the friction this replaced was that
    # only some screens had any way out at all.
    ('a screen, on u', ['u'], '· usage ·'),
    ('and back, on Backspace', ['\x7f'], '· conversation ·'),
    ('write and send, on i', ['i'], ''),
    ('the message in the composer', ['ola do tour'], '> ola do tour'),
    ('send it, on Enter', ['\r'], 'ola do tour', 2.0, '> ola do tour'),
    ('the reply arrives', [], 'Lia', 8.0),
]

# One entry per stop: (what it is, the keys — each written on its own — and either a
# marker that must appear, or the "view" the status line must be showing), plus the
# optional seconds to settle and text that must NOT be there.
TOUR = TOUR_SEEDED if os.environ.get('TOUR_SEEDED') == '1' else TOUR_CLEAN

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
        TUCANO_SEED='1' if os.environ.get('TOUR_SEEDED') == '1' else '0',
        TERM='xterm-256color',
        # The tour's markers are the status line's words, and the client speaks the
        # workspace's language (Portuguese by default), so the tour pins it to English.
        # The other side is covered by test/tuicano-language.test.tsx.
        TUCANO_LOCALE='en',
    )
    print(f"tour: {'seeded (the sample team)' if os.environ.get('TOUR_SEEDED') == '1' else 'clean start (the introduction)'} — {len(TOUR)} stops")
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
            # (what, keys, marker) with an optional settle in seconds and an optional
            # marker that must NOT be there: a number is the settle, a string is what
            # has to be gone.
            label, keys, marker = step[0], step[1], step[2]
            settle = step[3] if len(step) > 3 and isinstance(step[3], (int, float)) else 1.2
            absent = step[4] if len(step) > 4 else (step[3] if len(step) > 3 and isinstance(step[3], str) else None)
            watched = marker
            # What is drawn from this key on: an assertion that something closed must
            # not be satisfied (or defeated) by a frame from before the key.
            start = 0 if not keys else len(out)
            for key in keys:
                os.write(fd, key.encode())
                pump(0.3)  # a key and the next one are separate reads, never one write
            pump(settle)
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
