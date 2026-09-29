# Build "PortPilot": a macOS menu bar app for managing local dev ports

You are a senior Electron + TypeScript engineer and product designer. Build a polished, production-quality macOS menu bar utility that shows every local listening port, identifies which project or process owns it, and lets developers inspect, open, restart, or kill it in one click.

Make it feel native to macOS, like a first-party Apple utility with a developer's personality.

---

## 1. Tech stack (required)

- **Electron** (latest stable) with **TypeScript** in strict mode throughout (main, preload, renderer)
- **electron-vite** for build tooling
- **React 18 + TypeScript** for the renderer
- **Tailwind CSS** plus CSS variables for theming
- **Zustand** for state
- **Framer Motion** for micro-animations
- **lucide-react** for icons
- **electron-builder** for packaging (.dmg, universal arm64 + x64)
- **electron-store** for persisted settings
- **Vitest** for unit tests on parsers and utilities

### Security baseline

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- A typed preload bridge exposed via `contextBridge`. The renderer never touches Node APIs directly.
- Use `execFile` / `spawn` with argument arrays only. Never use `exec` with string interpolation.
- Validate every IPC payload in the main process with **zod**.

### Folder structure

```
src/
  main/
    index.ts             # app lifecycle, tray, windows
    tray.ts              # tray icon, badge, context menu
    ipc/                 # typed IPC handlers
    services/
      portScanner.ts     # lsof parsing
      processInfo.ts     # ps, cwd, command, cpu/mem
      projectDetector.ts # package.json / go.mod / Cargo.toml / etc.
      killer.ts          # graceful kill + escalation
      docker.ts          # docker container ports
      healthCheck.ts     # HTTP ping per port
      systemStats.ts     # CPU, RAM, chip info
      history.ts         # port open/close event log
  preload/index.ts
  renderer/
    components/ hooks/ store/ styles/ App.tsx
  shared/types.ts        # shared types between main & renderer
```

---

## 2. Core behavior

### Menu bar tray

- Template tray icon (monochrome, adapts to light/dark menu bar). The icon is a small terminal glyph with a port "plug".
- Show a badge or title count of active dev ports next to the icon (e.g. `3`). This is toggleable.
- Left click toggles the popover window. Right click opens a native context menu (Preferences, Kill All Dev Ports, Quit).
- The app has no Dock icon (`LSUIElement: true`, `app.dock.hide()`).

### Popover window

- Frameless, 420×560, anchored under the tray icon, rounded corners.
- macOS vibrancy (`vibrancy: 'popover'` or `'under-window'`) with a translucent dark/light glass look.
- Auto-hides on blur (unless pinned; see features).
- Smooth fade + scale-in animation on open.

### Port scanning

- Run `lsof -nP -iTCP -sTCP:LISTEN -F pcnLPT` and parse the field-output format robustly. Also support UDP optionally.
- Enrich each PID with:
  - `ps -o pid=,ppid=,user=,etime=,%cpu=,rss=,comm=,args= -p <pid>`
  - Working directory via `lsof -a -p <pid> -d cwd -Fn`
- Deduplicate IPv4/IPv6 entries for the same port and PID.
- Poll every 2s while the popover is open and every 10s in the background (configurable). Diff the results and only push changes over IPC.
- Put all parsers in pure functions with unit tests using fixture outputs.

### Project detection (the "smart name")

From the process cwd, walk up to the nearest project root and detect:

- `package.json` → use `name`, and detect the framework from dependencies (Next.js, Vite, Nuxt, Remix, Astro, SvelteKit, Express, NestJS, Storybook, Expo)
- `go.mod`, `Cargo.toml`, `pyproject.toml` / `manage.py` (Django), `Gemfile` (Rails), `pom.xml` / `build.gradle`, `composer.json`, `mix.exs`
- Known services by process name: postgres, mysqld, redis-server, mongod, nginx, docker-proxy / com.docker
- Show a framework icon or colored dot plus the project name. Fall back to the process name.

### Port row UI

- **Port pill** (monospace, e.g. `3000`), color-tinted by category: dev server, database, docker, system
- **Title**: project name. **Subtitle**: `runtime • PID 49201 • 14m uptime`
- Right side: context actions that appear on hover, plus a **Kill** button (coral/red, subtle fill)
- **Protected processes** (root-owned, `/System/*`, `/usr/libexec/*`, ControlCenter / AirPlay on 5000/7000, etc.) show a 🔒 lock instead of Kill, and appear dimmed.
- Expandable row (click or →) reveals the full command, cwd, CPU%, memory, parent PID, bind address, and a mini CPU sparkline.

### Killing processes (safe by default)

- Send `SIGTERM` first. If the process is still alive after 3s, show an inline "Force kill?" prompt, or auto-escalate to `SIGKILL` if that is enabled in settings.
- Animated row exit: strike-through, then fade and collapse.
- Show a toast: "Killed nextjs-dashboard on :3000", with a **Restart** action (see below).
- Never allow killing PID 1, the app's own PID, or protected processes.
- For processes owned by another user, offer an elevated kill via an `osascript ... with administrator privileges` prompt, with explicit confirmation.

### Search & keyboard

- Search bar at the top with a `⌘F` hint. It fuzzy-matches port, process, project, framework, and PID.
- Supports query syntax: `:3000`, `>5000` (ports above), `node`, `docker`, `db`.
- Full keyboard navigation: ↑/↓ to move, `Enter` to open in browser, `⌘⌫` to kill, `⌘C` to copy URL, `Space` to expand, `Esc` to close.
- Global hotkey (default `⌥⌘P`, customizable) to open the popover from anywhere.

### Footer

- A system strip: chip name (e.g. "Apple M1 Pro (10c)") • RAM • live CPU%. Clicking it expands to per-core bars and a memory pressure indicator.
- Status line: "● 3 dev ports active", plus `Quit ⌘Q`.

---

## 3. Creative extra features

1. **Restart / Revive**: Store the command, args, cwd, and env snapshot of every process before it's killed. The toast and the history view offer "Revive", which re-spawns it detached in the original cwd.
2. **Open & jump actions** per row: open `http://localhost:PORT` in the default browser, copy URL, open project in VS Code / Cursor / Zed (auto-detect installed editors), reveal in Finder, open a Terminal/iTerm/Warp tab at the cwd.
3. **LAN QR code**: For ports bound to `0.0.0.0`, show a QR code for `http://<LAN-IP>:PORT` to test on your phone instantly (use the `qrcode` package).
4. **Exposure warning**: Show a badge on services bound to `0.0.0.0` / `*` ("Visible on your network"), with a tooltip explaining the risk.
5. **Health pings**: Periodically send HTTP HEAD/GET to each dev port and show a status dot (200 green, 4xx/5xx amber/red, no HTTP = gray) with response time in ms.
6. **Port conflict helper**: A "Find free port" tool suggests the next free port near a requested number, e.g. "3000 is busy → 3001 is free". It includes a copy-ready `PORT=3001 npm run dev`.
7. **Docker awareness**: If Docker is running, list container port mappings (`docker ps --format json`) with container name and image. Actions are **Stop container** and **Open logs** instead of killing the Docker proxy.
8. **Grouping & views**: Toggle between flat list, grouped by project (a monorepo shows web + api + db together), and grouped by category. Include a "Kill group" action.
9. **Favorites & labels**: Pin ports to the top, give them custom nicknames and colors, and mark ports as "Never kill" (a protected list).
10. **Port history timeline**: A second tab with a log of opened/closed events (last 7 days), searchable, with Revive on past entries. Keep it in a local SQLite or JSON file with a size cap.
11. **Smart notifications** (native, toggleable): a new port opened, a watched port went down (crash detection), and a process eating more than X% CPU for more than 30s.
12. **Auto-cleanup rules**: Optionally kill dev servers idle longer than N hours, or kill all dev ports when the laptop sleeps or at a set time. Show a clear preview of what would be killed.
13. **Bulk actions**: Multi-select with `⌘-click`, "Kill all dev ports" (excluding favorites/protected), with a confirmation sheet listing exactly what will stop.
14. **Command palette** (`⌘K`): Search actions like "Kill :8080", "Open design-system-web", "Find free port", "Toggle theme".
15. **Pin window mode**: Detach the popover into a small always-on-top floating window for use during development.
16. **Stats nuggets**: For example, "You've killed 142 zombie servers this month" and "Most-used port: 3000". A little personality goes a long way.

---

## 4. Design system

- **Dark mode first**, with full light mode support, following system appearance or a manual override.
- Native font stack: `-apple-system, "SF Pro Text"`, and `"SF Mono", ui-monospace` for ports and PIDs.
- Palette (CSS variables): glass background `rgba(28,28,32,0.72)`, subtle 1px borders `rgba(255,255,255,0.08)`, accent configurable (default electric blue), Kill button coral `#E0735F` with a soft fill, success green, warning amber.
- 8px spacing grid, 10–12px row radius, and rows that lift slightly with a highlight on hover.
- Motion: 150–200ms ease-out, with stagger on list load and spring on expand. Respect `prefers-reduced-motion`.
- Empty state: a friendly illustration and the text "No ports listening. Go build something ✨".
- Accessibility: full keyboard control, visible focus rings, ARIA labels, and contrast ≥ 4.5:1.

---

## 5. Preferences window

A separate native-style window with tabs:

- **General**: launch at login, global hotkey, show count in menu bar, poll interval
- **Kill behavior**: grace period, auto-escalate to SIGKILL, confirm before kill, protected list
- **Filters**: hide system processes, show UDP, port ranges to ignore
- **Integrations**: preferred editor, terminal, browser, Docker toggle
- **Notifications & rules**: auto-cleanup schedules
- **Appearance**: theme, accent color, density (compact/comfortable)

---

## 6. Packaging & quality

- `electron-builder` config: dmg + zip, universal build, `LSUIElement`, hardened runtime, and entitlements. Include placeholders and notes for notarization.
- Auto-updates via `electron-updater` (GitHub releases).
- ESLint + Prettier, strict TS, and no `any`.
- Unit tests for the lsof/ps parsers, project detector, and port-conflict finder.
- README with a feature list, screenshots placeholder, keyboard shortcuts table, dev/build commands, and a note that no data leaves the machine.

---

## 7. Deliverables & process

1. Start with a short architecture plan and the shared TypeScript types (`PortEntry`, `ProcessInfo`, `ProjectInfo`, `KillResult`, `HistoryEvent`, `Settings`).
2. Build in this order: port scanner + tests → tray + popover → list UI → kill flow → search/keyboard → extra features → preferences → packaging.
3. Write complete, runnable code with no placeholder TODOs for core features.
4. After each milestone, state how to run it (`npm run dev`) and what to verify manually.
