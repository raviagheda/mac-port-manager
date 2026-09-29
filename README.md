# PortPilot

**A macOS menu bar app that shows which of your dev servers are running, and lets you kill the one that's squatting on port 3000.**

`lsof -i :3000` → squint at the PID → `kill -9 …` → realise it was the wrong one. PortPilot replaces that loop with a click.

It lives in your menu bar, lists every listening TCP port, names each one after the project that owns it, and hides the noise (AirPlay, IDE language servers, Homebrew daemons) so you only see what *you* started.

> **Status:** early (v0.1). The core port listing and kill flow work, but there are no signed binaries yet. You build it from source. See [Roadmap](#roadmap).

---

## Features

- **Menu bar popover.** Click the tray icon (no Dock icon) to see every listening port, sorted by port number and refreshed live.
- **Knows what's yours.** Each port is classified as `dev`, `database`, `docker`, `app`, `service` or `system`. The default **Dev** view shows only your dev servers; **All** shows everything.
- **Project names, not PIDs.** Rows are titled with the nearest `package.json` name from the process's working directory, with the runtime, PID and uptime underneath.
- **Safe kills.** Sends `SIGTERM` first and only offers **Force kill?** (`SIGKILL`) if the process ignores it. Root-owned and macOS system processes are locked 🔒 and can't be killed.
- **Kill All Dev Ports.** From the tray's right-click menu, with a confirmation dialog listing exactly what will stop. Databases, Docker, apps and system processes are never included.
- **Search with shortcuts.** Fuzzy search over port, process, project and PID, plus a small query syntax (below).
- **Keyboard-first.** Everything is reachable without the mouse.
- **Details on demand.** Expand a row for the full command line, cwd, CPU, memory, parent PID and bind addresses.

## How it tells dev servers apart from everything else

This is the part that makes the list useful. Every listener goes through a small, fully unit-tested classifier ([`src/main/services/classifier.ts`](src/main/services/classifier.ts)):

| Signal | Category | Examples |
|---|---|---|
| Known database process name | `database` | `redis-server`, `postgres`, `mysqld`, `mongod` |
| Docker process or `Docker.app` binary | `docker` | `com.docker.backend` |
| Binary under `/System`, `/usr/libexec`, `/usr/sbin`, or root-owned | `system` | ControlCenter (AirPlay on 5000/7000), `rapportd` |
| Binary inside a `.app` bundle | `app` | IDE language servers, Electron helpers |
| Parent is launchd *and* cwd is outside `$HOME` | `service` | `brew services` nginx |
| Anything else | `dev` | `next dev`, `vite`, `python -m http.server`, `rails s` |

The executable path and working directory come from a single `lsof -d cwd,txt` call per process. Framework interpreters such as Homebrew's `python3` (whose binary technically sits inside a nested `Python.app`) are correctly treated as dev.

If PortPilot misclassifies something on your machine, please [open an issue](https://github.com/raviagheda/mac-port-manager/issues) with the row's expanded details. That's the most useful bug report there is.

## Requirements

- macOS (Apple Silicon or Intel)
- Node.js 20+ and npm

## Install (from source)

```bash
git clone https://github.com/raviagheda/mac-port-manager.git
cd mac-port-manager
npm install
npm run dev
```

The tray icon appears in your menu bar. To build a standalone `PortPilot.app`:

```bash
npm run dist
```

The unpacked app is written to `release/`. Drag it into `/Applications`. The build is unsigned, so the first time you open it, right-click → **Open** to get past Gatekeeper.

## Usage

### Search syntax

| Query | Shows |
|---|---|
| `:3000` | exactly port 3000 |
| `>5000` | ports above 5000 |
| `node` | Node.js processes |
| `docker` | Docker-owned ports |
| `db` | databases |
| anything else | fuzzy match on port, process, project name and PID |

Search applies within the current **Dev / All** scope.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `⌘F` | Focus search |
| `↑` / `↓` | Move selection |
| `Enter` | Open `http://localhost:<port>` in your browser |
| `⌘C` | Copy the localhost URL |
| `Space` | Expand / collapse row details |
| `⌘⌫` | Kill the selected process |
| `Esc` | Close the popover |

## Privacy and security

- **Nothing leaves your machine.** No telemetry, no analytics, no network calls. PortPilot only runs `lsof` and `ps` locally.
- Commands are executed with `execFile` and argument arrays, never through a shell.
- The renderer runs with `contextIsolation`, `sandbox` and no Node integration. It talks to the main process only through a typed preload bridge, and every IPC payload is validated with [zod](https://zod.dev).
- It runs as your user and can only signal processes you own.

If you find a security issue, please report it privately through [GitHub Security Advisories](https://github.com/raviagheda/mac-port-manager/security/advisories/new) rather than a public issue.

## Tech stack

Electron · TypeScript (strict) · electron-vite · React 18 · Tailwind CSS · Zustand · Framer Motion · Vitest

```
src/
  main/            Electron main process: tray, popover, scan loop, IPC
    services/      lsof/ps parsing, classifier, project detection, killer
  preload/         Typed contextBridge API exposed to the renderer
  renderer/        React UI (components, hooks, Zustand store)
  shared/types.ts  Types shared across processes
```

## Contributing

Contributions are welcome, whether a bug report, a misclassified port, or a PR.

```bash
npm install
npm run dev         # run the app with hot reload
npm test            # unit tests (Vitest)
npm run typecheck   # strict TypeScript for main and renderer
```

A few conventions:

- Parsers and the classifier are **pure functions with fixture-based tests**. If you change how `lsof`/`ps` output is read, add a fixture captured from a real machine.
- Never shell out with string interpolation. Use `execFile` with an argument array.
- New IPC channels need a zod schema in `src/main/ipc/schemas.ts`.
- Please run `npm test` and `npm run typecheck` before opening a PR.

For anything larger than a small fix, open an issue first so we can agree on the approach.

## Roadmap

Planned, not yet built:

- [ ] Signed, notarized `.dmg` releases
- [ ] Framework detection (Next.js, Vite, Django, Rails, Go, Rust…) and non-Node project roots
- [ ] Global hotkey to open the popover
- [ ] Preferences window (poll intervals, auto-escalate to `SIGKILL`, launch at login)
- [ ] Revive: restart a killed server in its original directory
- [ ] Docker container names and stop/logs actions
- [ ] Open project in your editor or terminal
- [ ] "Find a free port" helper
- [ ] Health pings and "visible on your network" warnings for `0.0.0.0` binds

Ideas and votes on priorities are welcome in [Issues](https://github.com/raviagheda/mac-port-manager/issues).

## License

[MIT](LICENSE) © Ravi Agheda
