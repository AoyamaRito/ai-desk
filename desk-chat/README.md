# desk-chat

Browser-UI terminal that fronts `gemini` (or any TTY-aware CLI). Stage A of an A → B plan: a small local Node server bridges a child PTY over WebSocket; Stage B will eventually drop the server entirely and have the browser talk to the model API directly.

## Run (Stage A)

```bash
cd desk-chat
npm install                 # installs node-pty + ws
node server.js              # default: http://localhost:4000, runs `gemini`
```

Then open `http://localhost:4000` in a browser.

To front a different CLI:

```bash
CMD=claude node server.js                  # run `claude`
CMD=zsh node server.js                     # general shell
CMD=npx CMD_ARGS='@google/gemini-cli chat' node server.js
PORT=5000 node server.js                   # custom port
```

If the configured `CMD` isn't installed, the server falls back to `$SHELL` so you at least get a working terminal to debug from.

## Architecture (Stage A)

```
browser tab (Canvas terminal UI)
   ↑ WebSocket (binary frames + JSON control msgs)
   ↓
localhost:4000 (server.js — node-pty + ws)
   ↑ PTY (forkpty / CreatePseudoConsole)
   ↓
gemini-cli child process
```

### Files
- `server.js` (~150 lines) — HTTP static + WebSocket → PTY bridge.
- `index.html` (~500 lines vanilla, single file) — Canvas grid renderer + ANSI parser state machine + keyboard → escape-sequence translator + WebSocket client.
- `package.json` — declares the only two deps (`node-pty`, `ws`).

### What `index.html` implements
- Canvas-based monospace grid (auto-sizes to viewport).
- ANSI state machine: GROUND / ESC / CSI / OSC / DCS / charset.
- CSI handling: cursor moves (A/B/C/D/E/F/G/H/f/d), erase (J/K), insert/delete lines/chars (L/M/P/@/X), scroll region (r), save/restore (s/u/7/8), device queries (n, c).
- SGR: reset, bold, italic, underline, inverse, 16 + 256 + truecolor fg/bg.
- OSC 0/2: window title.
- Keyboard: full Ctrl + arrows + Home/End/PgUp/PgDn/Insert/Delete + Shift-Tab + Esc + paste.
- Cursor: visible block with inverse character overlay.

### What's intentionally NOT in Stage A
- Alt screen buffer swap (`\e[?1049h/l` is silently accepted, single buffer used). Programs like `vim` / `tmux` will work but won't restore the previous screen on exit.
- Scrollback buffer (only the visible viewport).
- Mouse reporting.
- Bracketed paste mode signalling (`\e[?2004h` accepted but no wrap).
- Sixel / kitty image protocols.
- Font ligatures.
- RTL / wide-character (CJK) cell-width handling — basic ASCII / monospace.

## A → B path

| Stage | Server does | Browser does | Deps |
|-------|-------------|--------------|------|
| **A** (this) | spawn CLI via PTY, WS bridge | terminal UI, ANSI parser | node-pty, ws |
| **A.5** | API key proxy + CORS only | + ANSI parsing of streamed API responses | ws (or none if HTTP only) |
| **B** | *(none)* | API call directly to Gemini, key in localStorage | *(zero)* |

Stage B is the ai-desk-aligned end-state: zero-server, zero-dep, browser-only. Each stage strips one server responsibility.

## Status

Stage A MVP. Tested manually with shells (`bash`, `zsh`). Compatibility with the actual `gemini` CLI depends on which interactive features it relies on; bracketed-paste-aware editors and alt-screen redrawing will degrade. Filing precise compatibility notes after first real-CLI session.
