# Archived assets

Active development is in this monorepo (**WireAssist**, a TechTrendWire product).

| Repo                                        | Status                                                          |
| ------------------------------------------- | --------------------------------------------------------------- |
| `wireassist-legacy` (formerly `WireAssist`) | Archive the pre-monorepo desktop repo; README should point here |
| `lai-core`, `lai-core-1`                    | Archived — README points here                                   |

Repos named in the harvest plan but not present under `Development/` (`linux-ai-assistant-archive`, `Linux-AI-Assistant---L.A.I.`, `gpt_assistant`, `agent-system`) need no action unless they reappear.

## GitHub rename sequence

The GitHub name `WireAssist` is currently held by the legacy repo. Order matters:

1. Rename legacy `WireAssist` → `wireassist-legacy`, archive it with a pointer README
2. Rename this repo (`Nolta`) → `WireAssist`

## `build-packages.yml`

Deferred from the legacy desktop repo. Builds AppImage/DEB/RPM for the Tauri app, which is frozen.

Do not wire this into `.github/workflows/` unless the desktop app is revived as **WireAssist Desktop**. When that day comes, rewrite paths from `linux-ai-assistant/` to the current package layout before enabling.

## Historical phase/setup notes

Moved from the repo root — each already carried a "Historical document" banner pointing at current docs before the move:

- `PHASE_1_COMPLETE.md`, `PHASE_2_STREAMING.md`, `PHASE_3_CONTEXT_BUILDING.md` — AIA-app development milestones (Nov 2024), reference `packages/core`/`@aia/core` paths that no longer exist.
- `MONOREPO_SETUP.md` — original pnpm-workspace layout before the `wireassist/` + `packages/agents/*` restructure.
- `PRIVACY_CONTROLS.md` — AIA app's encryption/audit-log implementation notes; the code they describe now lives under `wireassist/aia/src/lib/services/`.

For current setup/architecture, see the root `README.md` and `docs/SETUP.md` / `docs/ARCHITECTURE.md`.
