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
