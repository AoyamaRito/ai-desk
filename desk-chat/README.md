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

---

## Stage B (`standalone.html`) — browser-only, zero-server

`desk-chat/standalone.html` is the Stage B realisation: a single HTML file that talks to Gemini directly from the browser. **No server, no PTY, no CLI process.** Open the file in a browser, paste a Gemini API key (Settings), chat.

### What it does

- Chat UI on the left, virtual workspace pane on the right (toggle with `files` button).
- The model has 4 tools: `read_file`, `write_file`, `list_files`, `delete_file`.
- All files live in **OPFS (Origin Private File System)** under `workspace/`. Persists across refreshes.
- Chat history kept in `localStorage`. API key kept in `localStorage` (never sent anywhere except the Gemini endpoint).
- ~580 lines, single file, vanilla. Deps: zero.

### Why this is "true Stage B" and not a thin wrapper

Stage A (`server.js` + `index.html`) had to:
- Spawn `gemini` as a child process via PTY (needs `node-pty`)
- Bridge stdout/stdin over WebSocket (needs `ws`)
- Pretend to the CLI that it's running in a real terminal

Stage B drops all of that. The model is invoked directly via HTTPS, tools are JS functions running in the browser, files live in OPFS. No process to spawn, no terminal to emulate. This is the **fully ai-desk-aligned end-state**: zero-server, zero-dep, Web-standards-only, eternal compatibility.

### Run

Just open the file:

```bash
open desk-chat/standalone.html
```

Or serve from any static host (GitHub Pages works, since the file is fully static):

```
https://<your-pages>/desk-chat/standalone.html
```

Get a Gemini API key from <https://aistudio.google.com/apikey>, paste it in Settings, start chatting.

### Limits / next steps

- Only Gemini provider for now. Adding Anthropic / OpenAI is mostly a `callGemini()` adapter swap.
- No file upload yet (drag-and-drop into OPFS would be ~30 lines).
- No export-as-zip yet (build a zip in the browser, trigger download — ~50 lines).
- No multi-conversation. One chat history per origin.
- Tool surface is intentionally minimal; the user observation that "LLM only touches a small surface" drove the 4-tool API.
