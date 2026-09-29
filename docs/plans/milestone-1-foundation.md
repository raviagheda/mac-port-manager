# PortPilot — Milestone 1: Foundation + Core Port Management

## Context

`docs/portpilot-prompt.md` specifies a full-featured macOS menu bar utility for managing local dev ports (tray/popover, live scanning, kill/revive, search, 16 "creative" extra features, a multi-tab preferences window, and DMG/notarization packaging). The project directory is currently empty (only the spec doc exists) — this is a from-scratch build, not an existing-codebase modification.

Given the scale of the full spec, the user chose a **staged build**: this plan covers only the first milestone, built in the exact order the spec's own "Deliverables & process" section lays out — scaffold → shared types → port scanner + tests → tray + popover → list UI → kill flow → search/keyboard. Everything past that (the 16 creative features, full Preferences window, packaging/notarization, full design polish) is explicitly deferred to future passes so this milestone stays scoped, verifiable, and shippable on its own. The user also asked to initialize git and use npm.

## Scope for this milestone

**In scope:** project scaffold, shared types, port scanner (`lsof` parsing) with unit tests, process enrichment (`ps` + cwd) with unit tests, tray + popover shell with vibrancy/animation, a functional (not fully polished) port list UI, minimal project-name detection (package.json only), the kill flow (SIGTERM → SIGKILL escalation, protected-process guard), and search + keyboard navigation.

**Out of scope (future passes):** all 16 creative extra features (revive, LAN QR, health pings, docker awareness, favorites, history timeline, notifications, auto-cleanup, bulk actions, command palette, pin window, stats nuggets, etc.), the full multi-tab Preferences window, electron-builder DMG/notarization/auto-update pipeline, full framework detection beyond package.json name, CPU sparklines, and final design-token/motion polish.

---

## 1. Folder/file layout

```
port-manager/
  .gitignore
  package.json
  tsconfig.json
  tsconfig.node.json          # main + preload + shared
  tsconfig.web.json           # renderer (DOM types)
  electron.vite.config.ts
  tailwind.config.js
  postcss.config.js
  vitest.config.ts
  src/
    shared/types.ts           # PortEntry, ProcessInfo, ProjectInfo, KillResult, HistoryEvent (stub), Settings (stub), PortPilotBridge, PortListPatch
    main/
      index.ts                # app lifecycle, dock hide, wires tray + popover + scan loop
      tray.ts                 # tray icon, click routing, context menu, popover positioning
      scanLoop.ts             # polling orchestration + diffing + IPC broadcast
      ipc/
        index.ts
        schemas.ts             # zod schemas for every channel
        portHandlers.ts
        killHandlers.ts
        windowHandlers.ts
      services/
        portScanner.ts         # lsof -F pcnLPT parsing (pure) + entry assembly
        processInfo.ts         # ps + lsof-cwd parsing (pure) + getProcessInfo()
        projectDetector.ts     # minimal package.json name lookup
        killer.ts               # SIGTERM/SIGKILL state machine + protected guard
      services/__tests__/
        portScanner.test.ts
        processInfo.test.ts
    preload/
      index.ts                 # contextBridge.exposeInMainWorld('portpilot', bridge)
      index.d.ts                # Window.portpilot global augmentation
    renderer/
      index.html
      main.tsx
      App.tsx
      components/
        PortList.tsx
        PortRow.tsx
        SearchBar.tsx
        Toast.tsx
        EmptyState.tsx
      hooks/
        usePortsBridge.ts
        useKeyboardNav.ts
      store/
        usePortStore.ts
        useToastStore.ts
      lib/
        search.ts               # query parsing + filtering (pure, testable)
        format.ts                # formatUptime, formatBytes
      styles/globals.css
```

Two deliberate additions beyond the spec's literal per-file list: `main/scanLoop.ts` (polling/diff/broadcast orchestration — doesn't belong in a pure parser service or in `index.ts`) and including `killer.ts` now (not deferred like docker/health/stats/history) since Kill Flow is in scope this milestone.

## 2. Scaffold

- **electron-vite** with three build targets (main/preload/renderer); renderer `root: 'src/renderer'` so `index.html` sits directly under `src/renderer/`. Path aliases `@shared`, `@renderer`.
- **package.json** scripts: `dev` (`electron-vite dev`), `build`, `preview`, `typecheck` (tsc --noEmit on both tsconfigs), `test` (`vitest run`), `test:watch`, `dist` (`electron-builder --dir`, minimal sanity build only — no notarization this milestone).
- **Versions** (checked against npm registry 2026-09-27): `electron@44.x`, `electron-vite@5.x`, `electron-builder@26.x`, `zustand@5.x`, `framer-motion@13.x`, `vitest@5.x`, `zod@4.x`. Pin `react@^18`/`react-dom@^18` explicitly (spec requires React 18; registry default is 19). Pin `tailwindcss@^3.4` (not v4, which drops `tailwind.config.js`/`postcss.config.js` — the spec and this plan assume the classic v3 config files exist). Defer `electron-store` entirely this milestone (Settings persistence isn't required yet); if pulled in later, pin `^8.x` to avoid ESM/CJS friction.
- **tsconfig.node.json**: strict, `noUncheckedIndexedAccess`, ESNext/bundler resolution, `types: ["node"]`, covers `src/main`, `src/preload`, `src/shared`.
- **tsconfig.web.json**: strict, `lib: ["DOM","ES2022"]`, covers `src/renderer`, `src/shared`, and `src/preload/index.d.ts` (so the renderer sees the `Window.portpilot` global).
- **tailwind.config.js**: `content: ['src/renderer/**/*.{ts,tsx,html}']`, theme colors mapped to CSS variables defined in `globals.css`.
- **vitest.config.ts**: `environment: 'node'`, same aliases, `include: ['src/**/*.test.ts']`.
- **Security baseline** (BrowserWindow + preload, non-negotiable): `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Renderer never touches Node/Electron APIs directly — everything goes through `contextBridge.exposeInMainWorld('portpilot', bridge)`. Every IPC payload is validated with a zod schema in main before use.
- **.gitignore**: `node_modules/`, `dist/`, `out/`, `.env`, `.DS_Store`, `release/`.
- `git init`, commit the scaffold as a first checkpoint before moving on.

## 3. Shared types (`src/shared/types.ts`)

Core interfaces: `PortEntry` (id, port, protocol, addresses[], isWildcard, pid, command, state, category, process?, project?, protected, lastSeenAt), `ProcessInfo` (pid, ppid, user, etimeSeconds, cpuPercent, memoryKb, comm, args, cwd), `ProjectInfo` (name, root, framework — always null this milestone, kind: 'node'|'unknown'), `KillResult` (pid, port?, success, stage, method?, error?), `PortListPatch` (added/updated/removed), `PortPilotBridge` (the full typed preload surface: `ports.getSnapshot/onUpdate`, `kill.request/confirmForce/onUpdate`, `window.hide`, `shell.openLocalhost`, `clipboard.writeText`). `HistoryEvent` and `Settings` exist as minimal stubs (Settings holds poll intervals, kill grace period, auto-escalate flag, badge toggle) for forward-compatibility with later milestones, not fully wired to a Preferences UI yet.

## 4. IPC contract

Channels: `ports:get-snapshot` (invoke → `PortEntry[]`), `ports:update` (main→renderer send, `PortListPatch`), `kill:request`/`kill:confirm-force` (invoke, zod-validated `{pid, port?}`/`{pid}`, immediate ack `KillResult`), `kill:update` (main→renderer send, async progress), `window:hide` (one-way), `shell:open-url` (invoke `{port}` — main builds the `http://localhost:PORT` string itself; renderer never sends a raw URL), `clipboard:write-text` (invoke `{text}`, length-capped). All schemas centralized in `ipc/schemas.ts`; each handler does `schema.safeParse` before touching payload data. Kill handlers return immediately (fire-and-forget signal) and report progress asynchronously over `kill:update` rather than blocking the invoke promise for the 3s grace period. Poll cadence (2s active / 10s background) is toggled directly by `tray.ts`'s `showPopover()`/`hidePopover()` calling `scanLoop.setPollingActive()` — no renderer round-trip needed.

## 5. Port scanner (`lsof -F pcnLPT` parsing)

Parses the field-record format: `p<pid>` starts a process context (resets command/user), `c<command>`/`L<user>` set process-level fields, `f<fd>` starts a file record (flush previous), `P<protocol>`/`n<name>`/`T<key>=<value>` attach to the current file record; flush on EOF. Keep only `protocol === 'TCP'` + `TST === 'LISTEN'`. Host/port split handles bracketed IPv6 (`[::1]:27017`) vs plain (`*:3000`, `127.0.0.1:3000`). **Dedup key is `${pid}:${port}`** (not address) — real captured fixtures confirm both a genuine duplicate-wildcard case (ControlCenter, two fds both on `*:7000`) and a genuine IPv4/IPv6 pair case (mongod on `127.0.0.1:27017` + `[::1]:27017`) must collapse to one `PortEntry` each, with `addresses` deduped via `Set`. Exported pure functions: `parseLsofRecords`, `splitHostPort`, `toPortEntries`. Unit tests (fixtures captured live from this machine) cover: single dev-server listener, dual-fd wildcard dedup, IPv4/IPv6 pair dedup, and multi-process boundary (command/user attribution doesn't leak across a `p` boundary).

## 6. Process enrichment (`ps` + `lsof cwd`)

`parsePsLine` regex-captures pid/ppid/user/etime/cpu/mem as fixed whitespace-delimited fields, with `comm` as a single token and everything after as `args` — real captured output confirms macOS `comm=` is normally a short space-free token. Documented limitation: GUI helper process names containing spaces (e.g. "Google Chrome Helper") will misattribute the comm/args split, since `ps -o comm=,args=` gives no unambiguous delimiter; call this out in a comment and a test documenting the behavior. `parseEtime` handles `mm:ss` / `hh:mm:ss` / `dd-hh:mm:ss`. `parseCwdOutput` finds the `n`-prefixed line after `fcwd`, returns `null` on empty/permission-denied output (never throws — root-owned PIDs legitimately fail here). `getProcessInfo(pid)` runs the `ps` and `lsof cwd` execFile calls in parallel via `Promise.allSettled`-style independent error handling (a cwd permission failure shouldn't kill the whole enrichment). All parsing functions are pure and covered by fixture-based unit tests using real captured lines.

## 7. Kill flow

State machine: `Idle → (kill:request) → Terminating` (SIGTERM sent, 3s timer starts) `→ Terminated` (if the process exits first, checked via `process.kill(pid, 0)` liveness polling) `→` on timer expiry, either auto-escalate to SIGKILL (if `settings.autoEscalateToSigkill`) or `AwaitingConfirmation` (pushed over `kill:update`, resolved by a `kill:confirm-force` call) `→ Killed`/`Failed`. Tracked per-PID in a `Map<number, KillSession>` in `killer.ts` so concurrent kills and scan-cycle refreshes don't collide. **Protected-process guard** (`isProtectedProcess`) checks exactly the four required cases: `pid === 1`, `pid === process.pid` (the app itself), `user === 'root'`, or path starts with `/System/` or `/usr/libexec/`. Computed during enrichment (so the UI can show the lock icon) *and* re-checked server-side inside the kill handlers before any signal is sent, regardless of what the renderer displays.

## 8. Tray + popover

BrowserWindow: 420×560, frameless, `transparent: true`, `vibrancy: 'popover'`, `resizable: false`, `skipTaskbar: true`, same security webPreferences as above. `app.dock?.hide()` at startup; `LSUIElement: true` added to electron-builder's `mac.extendInfo` for packaged builds. Tray click routing uses `tray.on('click', ...)`/`tray.on('right-click', ...)` directly (not `setContextMenu`, which would bind the menu to left-click too) — right-click calls `tray.popUpContextMenu()` with items `Preferences` (present, disabled this milestone), `Kill All Dev Ports` (confirms via `dialog.showMessageBox` listing the current non-protected ports, then kills each), `Quit`. `positionPopoverUnderTray` computes position from `tray.getBounds()`, clamped to the display's work area. `showPopover()`/`hidePopover()` are the single source of truth for visibility *and* poll cadence (no renderer round-trip); guard against the tray-click/blur race with a `lastHideAt` timestamp (skip re-show if a click arrives within 150ms of an auto-hide-on-blur). Open animation is renderer-side: main sends a `popover:will-show` event before `.show()`, renderer bumps a Framer Motion remount key to replay the fade+scale-in (`prefers-reduced-motion` respected via `useReducedMotion()`).

`scanLoop.ts` owns the interval (2s/10s, toggled by `setPollingActive`), runs each cycle: scan → parse → enrich (parallel per unique PID, cached within the cycle) → attach `protected`/`project`/`category` (category via simple name heuristics: postgres/mysqld/redis-server/mongod → database, comm includes "docker" → docker, protected → system, else dev) → `diffSnapshots` (pure, unit-testable) → broadcast only non-empty patches over `ports:update`.

## 9. Renderer

**Zustand store** (`usePortStore.ts`): normalized `ports: Record<id, PortEntry>` + `order: string[]`, `selectedId`, `expandedId`, `searchQuery`, `killStates: Record<pid, KillResult>`; actions `setSnapshot`, `applyPatch`, `setSearchQuery`, `setSelected`, `setExpanded`, `applyKillUpdate`. Separate `useToastStore.ts` for a small auto-dismissing toast queue. `usePortsBridge.ts` wires `window.portpilot.ports.getSnapshot()`/`onUpdate`/`kill.onUpdate` into the store on mount, returning cleanup unsubscribes.

**Search** (`lib/search.ts`, pure/testable): `parseQuery`/`filterPorts` handle `:3000` (exact port), `>5000` (port above), keyword aliases (`node`, `docker`, `db` map to category/comm checks), and otherwise a subsequence-based fuzzy match over `port + comm + project.name + command + pid`.

**Components**: `App.tsx` (mounts bridge, search bar, list, toasts, owns the animation remount wrapper), `PortList.tsx` (`AnimatePresence`-wrapped rows, exit animation on kill), `PortRow.tsx` (monospace port pill, title = project name or process name, subtitle = `comm • PID • uptime`, disabled+🔒 Kill button when protected, expandable on click/Space showing args/cwd/cpu/mem/ppid/addresses — no CPU sparkline this milestone), `SearchBar.tsx`, `Toast.tsx` (no Restart action yet — deferred).

**Keyboard** (`useKeyboardNav.ts`, window-level, aware of whether focus is in the search input): `↑`/`↓` move selection, `Enter` opens `http://localhost:PORT`, `⌘⌫` triggers kill, `⌘C` copies the URL, `Space` toggles expansion, `Esc` hides the popover.

## Verification plan

1. `npm install && npm run dev` — confirm no Dock icon / not in ⌘-Tab.
2. Tray icon renders as a monochrome template glyph; toggle light/dark appearance and confirm it adapts.
3. Left-click opens the popover under the tray icon with fade+scale-in and visible vibrancy; right-click shows the native menu (Preferences disabled, Kill All Dev Ports, Quit); clicking elsewhere auto-hides it.
4. Start `python3 -m http.server 8123` in a terminal — confirm a new row appears within ~2s with the correct port/process/PID/uptime.
5. Start a Node server from inside a directory with a `package.json` — confirm the row's title shows that project's `name` field.
6. Search: `:8123` isolates that row, `>5000` filters by threshold, `python` fuzzy-matches by process name, `db` filters to database category (if a local DB is running).
7. Keyboard: arrow-key navigation, `Enter` opens the browser, `⌘C` copies the URL (verify via paste), `Space` expands showing cwd/args/cpu/mem, `Esc` hides the popover.
8. Kill (graceful): kill the http.server row, confirm "Terminating…" state, process exits within ~3s (`ps -p <pid>` empty), toast appears, row animates out, `lsof -iTCP:8123` returns nothing.
9. Kill (escalation): start a Node process that ignores SIGTERM, kill it via UI, confirm the "Force kill?" prompt appears after 3s, confirm it, verify the process is actually gone via `ps -p <pid>`.
10. Protected guard: find a root-owned or `/System`/`/usr/libexec` listener (`sudo lsof -iTCP -sTCP:LISTEN`), confirm its row shows 🔒 with Kill disabled.
11. "Kill All Dev Ports" with a few test servers running: confirm the confirmation dialog lists them correctly and protected ones are excluded.
12. `npm run test` — `portScanner.test.ts` and `processInfo.test.ts` pass using the real-machine fixtures.
13. `npm run typecheck` — zero errors under strict TS on both tsconfigs.
