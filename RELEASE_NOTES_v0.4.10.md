# pi-desktop v0.4.10

## Highlights
- Added a dedicated history button on each project row so historical sessions can be opened without using the context menu.
- Fixed terminal state leakage across agents and removed the duplicate terminal tab issue during initialization.
- Fixed macOS release icon generation to output a real `.icns` file for better Dock rendering.
- Improved composer safety on small windows and set better defaults for newly added models: `contextWindow=1000000`, `maxTokens=128000`, reasoning enabled.

## Verification
- `npm run make-icon`
- `npm run typecheck`
- `npm run build`
