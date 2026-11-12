# CW Player

CW Player is web app for listening to (long) texts in Morse code.

## AI Disclosure

This project was built with the assistance of AI.

- **Tools Used:** DeepSeek and Codex.
- **Scope:** AI generated and modified substantial parts of the implementation, including the PWA interface, controllers, audio integration, automated tests, documentation, and build/deployment configuration.
- **Human Verification:** All (or most) logic and final integrations were manually reviewed, debugged, and verified by the maintainer through manual testing.

## Run locally

```sh
make install
make dev
```

Open the local URL printed by Vite. `make help` lists the other targets; they
wrap the equivalent pnpm scripts. The release build of the Rust/WASM renderer is pinned at `public/engine/cwtone.wasm`; normal builds do not need the Rust toolchain. The browser renders PCM in a worker and plays it through an AudioWorklet using bounded buffering. The development server does not register the service worker.

The engine lives in the separate [`cwtone`](https://github.com/perja12/cwtone) repository, which publishes versioned `cwtone.wasm` release artifacts. This app pins the currently checked-in artifact and records its version and SHA-256 in `CWTONE_VERSION` and `CWTONE_SHA256`; CI verifies the hash before building. To refresh it from a sibling `cwtone` checkout:

```sh
pnpm build:wasm
```

Set `CWTONE_DIR=/path/to/cwtone` if the checkout lives somewhere else.

## Try the installable offline app

```sh
pnpm build
pnpm preview --port 4173
```

Open `http://localhost:4173/`, wait for the page to finish loading once, and then use the browser's install command (or the in-app Install button when the browser offers it). The production build generates a versioned service worker that precaches the app, audio engine, and MP3 encoder. After the first successful load, the app shell and playback engine are available offline. Library texts, marks, settings, and listening time are stored locally in IndexedDB/local storage.

## External HID controls

You can drive **Word recognized** from a USB HID device (for example a
Raspberry Pi Pico programmed as a keyboard). While playback is running, the app
listens for these physical keys:

- left and right `Control`
- `A`, `S`, `Z`, `X`
- `Space`

Each press adds the word at the current playback position to Practice Review,
exactly like the button in the player dock. The keys are ignored while typing in
a form field or while a dialog is open, and key auto-repeat does not add
duplicate marks.

The keys only work while the app/tab is focused and the device is awake. When a
phone or tablet turns its screen off, the operating system normally suspends the
browser and stops delivering key events, so a web app cannot receive HID presses
with the screen truly off. On a desktop where only the monitor sleeps, the
events still arrive as long as the computer and browser stay awake. To use the
controller with the display dark on mobile, keep the device awake (for example
with a kiosk setting or a screen wake lock) rather than letting it sleep.

## Checks and end-to-end tests

```sh
pnpm lint         # ESLint (type-aware) + Stylelint
pnpm format       # Prettier write
pnpm format:check # Prettier check
pnpm test:arch    # tsarch building-block and dependency rules
pnpm test:unit    # Vitest unit tests (model, views, stores, UI)
pnpm test:watch   # Vitest watch mode; reruns only affected specs
pnpm test:related src/model/playback.ts # one-shot check of specs affected by a file
pnpm test:coverage # unit tests + V8 coverage with thresholds
pnpm check        # cached lint + format + typecheck + architecture + coverage
pnpm test         # Playwright end-to-end suite
pnpm test:e2e:ui  # Playwright UI mode for iterating on end-to-end flows
pnpm verify       # pnpm check + pnpm test
```

For fast feedback while editing, keep `pnpm test:watch` running: it reuses the Vite transform cache and reruns only the specs affected by a change, typically in well under a second. `pnpm test:related <file>` runs the same affected set once. ESLint, Stylelint, and Prettier use local caches, so a warm `pnpm check` takes roughly half the time of the first run.

The source is split into model, view, controller, store, client, audio, and UI building blocks; [`ARCHITECTURE.md`](ARCHITECTURE.md) explains the boundaries. `arch/access-rules.spec.ts` encodes those boundaries with tsarch and runs with Vitest. `tsconfig.arch.json` is a small dedicated config because tsarch does not resolve `extends`.

Unit coverage is measured with `@vitest/coverage-v8` and gated in `pnpm check`. Thresholds in `vitest.unit.config.ts` keep the unit-testable layers honest: `src/model`, `src/ui`, `src/views`, and `src/app/*-store.ts` are expected near 100%, while the whole-source floor prevents regressions elsewhere. The HTML report is written to `coverage/` (ignored by Git). Feature controllers, audio orchestration, IndexedDB access, and worker/WASM glue are exercised by Playwright rather than unit tests, so they show low unit coverage by design; see [`ARCHITECTURE.md`](ARCHITECTURE.md#test-coverage) for the seam map.

ESLint covers TypeScript, the engine workers, and config files with type-aware `recommendedTypeChecked` rules; `tsconfig.eslint.json` includes `src`, `tests`, `arch`, and the config files so worker messages are typed. Stylelint uses `stylelint-config-recommended` for CSS. Prettier owns formatting; `eslint-config-prettier` disables rules that would conflict with it. The Playwright suite builds the production app, starts a preview server on port 4173, and drives the installed Google Chrome. It covers the sound settings (including Extra word gap), Follow along selection previews, and Practice Review word previews. The Rust engine has its own tests and CI in the [`cwtone`](https://github.com/perja12/cwtone) repository; run them with `cargo test --offline --workspace` from that checkout, together with `cargo fmt --all -- --check` and `cargo clippy --offline --workspace --all-targets -- -D warnings`.

## License and attribution

CW Player and its `cwtone` engine are free software under the **GNU General Public License, version 3 or later**. See [`LICENSE`](LICENSE).

The engine is a Rust/WebAssembly reimplementation inspired by **cwwav** by Thomas Horsten (M0TRN), Copyright © 2011–2014, licensed under GPL-3.0-or-later. The original project is at <https://gitlab.com/oyvholm/cwwav>. See [`NOTICE`](NOTICE) for the full attribution and modification notice.

The bundled public-domain text of Fridtjof Nansen's _På ski over Grønland_ comes from the National Library of Norway's [Public Domain Texts from NBdigital](https://www.nb.no/sprakbanken/ressurskatalog/en/oai-nb-no-sbr-34/) corpus (CC0 1.0).

Third-party components are listed in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md); the deployed copies are under `public/licenses/`. The app also exposes the license, source, and third-party notices from the Sound & timing dialog.

## Deployment

GitHub Actions builds and deploys the app to GitHub Pages. The workflow in `.github/workflows/pages.yml` runs `pnpm verify` (lint, formatting, typecheck, architecture and coverage checks, plus Playwright), builds the production PWA, and publishes `dist` when `main` is pushed. Pull requests run the same checks without deploying.

The Pages site is configured for `cwplayer.lb2kk.no` through `public/CNAME`. In the repository settings:

1. Set **Pages → Build and deployment → Source** to **GitHub Actions**.
2. Set **Pages → Custom domain** to `cwplayer.lb2kk.no`.
3. Add a DNS `CNAME` record for `cwplayer` pointing to `perja12.github.io`.

The build uses the root path (`/`), which matches the custom domain. Node and pnpm versions come from `.nvmrc` and the `packageManager` field in `package.json`.

The MP3 path bundles `wasm-media-encoders` and StreamSaver.js under `public/`; their license notices are included next to the assets. Export is disabled during active playback, can be canceled, and does not keep the complete encoded file in memory. While the browser's save dialog is open the export waits and explains why; if the browser never starts or stops accepting the stream, the export times out with an actionable message instead of hanging.

`pnpm-lock.yaml` is the package lockfile for this app.

Hope that is useful!

73 DE LB2KK
