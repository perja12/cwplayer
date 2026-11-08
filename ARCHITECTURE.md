# CW Player architecture

The player is split into small modules with explicit building blocks. The
authoritative, executable definition lives in [`arch/access-rules.spec.ts`](arch/access-rules.spec.ts);
this document explains the intent behind those rules.

## Building blocks

| Building block  | Location / suffix                                              | Responsibility                                                                                            | May depend on                            |
| --------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Model           | `src/model/*.ts`                                               | Pure domain logic: text analysis, formatting, queue descriptions, span lookup. No DOM, storage, or audio. | Other models only                        |
| UI primitives   | `src/ui/*.ts`                                                  | HTML escaping, icons, cover art, modal/toast helpers, theme application.                                  | Model, other UI                          |
| Client          | `src/**/*-client.ts`                                           | Browser or IO integration: IndexedDB, `localStorage`, image encoding, StreamSaver, WASM loading.          | Model                                    |
| Store           | `src/**/*-store.ts`                                            | Mutable application state shared by views and controllers. No rendering and no audio nodes.               | Model, clients, UI                       |
| View            | `src/views/*-view.ts`                                          | Produces HTML from stores/models. No event wiring and no audio.                                           | Model, stores, UI, other views           |
| Controller      | `src/controllers/*-controller.ts`, `src/audio/*-controller.ts` | DOM events, feature orchestration, audio playback and preview lifecycles.                                 | Views, stores, clients, audio, model, UI |
| App composition | `src/app/app-controller.ts`, `src/app/bootstrap.ts`            | The only place that composes views and controllers, and the only place that starts the application.       | Everything                               |
| Entry point     | `src/main.ts`                                                  | Imports styles and calls `bootstrap()`.                                                                   | App composition                          |

The render bus (`src/app/render-bus.ts`) is the small notification seam that lets
controllers request a full render, a progress-only update, or a selection-popup
update without importing the composition root. This keeps the dependency graph
acyclic.

## Dependency direction

```text
main.ts
  -> app/bootstrap.ts
       -> app/app-controller.ts
            -> views/*-view.ts        -> model, stores, ui, other views
            -> controllers/*.ts       -> views, stores, clients, audio, model, ui
            -> audio/*-controller.ts  -> stores, clients, audio, model, ui
            -> app/*-store.ts         -> model, clients, ui
            -> data/*-client.ts       -> model
            -> model/*.ts             -> model only
```

Views never import controllers, audio, or data clients. Models never import
anything outside `src/model`. Stores never import views, controllers, or audio.
Clients never import views, controllers, stores, audio, app, or UI. Audio code
never imports views or feature controllers. Only `bootstrap.ts` may import the
app controller, and `main.ts` imports only the bootstrap.

## Rules enforced by tsarch

`pnpm test:arch` runs [`arch/access-rules.spec.ts`](arch/access-rules.spec.ts)
with Vitest. The rules cover:

- pure models with no outward dependencies;
- views that do not reach into controllers, clients, data, or audio;
- UI primitives that do not depend on application layers;
- stores that do not depend on views, controllers, or audio;
- clients that do not depend on views, controllers, stores, audio, UI, or app;
- data and audio layers that do not depend on orchestration or views;
- composition-root boundaries for `bootstrap.ts` and `main.ts`;
- a cycle-free source tree.

Violations are reported as `source -> target`, for example:

```text
src/model/__probe.ts -> src/views/nav-view.ts
```

## Adding code

- Pure logic and calculations: `src/model/`.
- New HTML: a `src/views/*-view.ts` module.
- New browser event handling or feature flow: `src/controllers/*-controller.ts`.
- Persistent or shared state: a `src/app/*-store.ts` module.
- A new external integration: a `src/*-client.ts` module, usually under `src/data/`.
- Playback or preview behavior: `src/audio/*-controller.ts`; expose user actions
  through a feature controller.
- A new top-level feature: add a controller with a `bind*Events()` function and
  call it from `renderApp()` in `src/app/app-controller.ts`.

Keep filenames aligned with their building block. The architecture test
classifies files by suffix and folder, so a file renamed to the wrong suffix is
no longer protected by the intended rule.

## Test coverage

`pnpm test:coverage` runs the Vitest unit suite with V8 coverage and enforces the
thresholds in [`vitest.unit.config.ts`](vitest.unit.config.ts). The HTML report is
written to `coverage/` (ignored by Git). Coverage is part of `pnpm check`, so
`pnpm verify` fails if the unit-testable layers regress.

The current seam map:

| Layer                                 | Unit coverage | How it is verified                                                                                  |
| ------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| `src/model/`                          | ~100%         | Vitest in a node environment                                                                        |
| `src/ui/`                             | ~100%         | Vitest with jsdom shims                                                                             |
| `src/views/`                          | ~100%         | Render functions asserted with jsdom                                                                |
| `src/app/*-store.ts`                  | ~100%         | Vitest with mocked storage clients                                                                  |
| `src/app/render-bus.ts`               | ~100%         | Direct renderer spies                                                                               |
| `src/controllers/`                    | low           | Playwright user flows; MP3 export progress and timeout states unit-tested                           |
| `src/audio/`                          | low           | Playwright playback and preview flows                                                               |
| `src/data/`                           | mixed         | `settings-client` unit-tested; IndexedDB, images, StreamSaver via Playwright or manual verification |
| `src/app/bootstrap.ts`, `src/main.ts` | 0%            | Playwright boots the built app                                                                      |

This split is intentional. Views are pure HTML builders, stores are plain state,
and the model is independent, so they can be tested directly. Feature
controllers and audio code own Web Audio nodes, workers, and DOM lifecycles;
they are covered end-to-end. When controller logic grows complex, extract the
calculation into `src/model/` and test it there instead of mocking Web Audio.

Decisions currently extracted this way include queue advancement and editing,
engine span decoding, frame-to-text position, saved listening-position
byte mapping, listening-time accounting,
settings-form parsing, MP3 filename sanitizing, transport selection, and
selection-popup placement.

Vitest runs unit specs with `environment: "node"` by default; DOM specs opt in
with `// @vitest-environment jsdom` and share the shims in
[`tests/unit/setup.ts`](tests/unit/setup.ts).

## Why `tsconfig.arch.json` exists

tsarch reads the tsconfig directly and does not resolve `extends`. `tsconfig.arch.json`
therefore repeats the compiler options and `include`/`exclude` paths it needs.
Keep it in sync with `tsconfig.json` when the source layout changes.

The published tsarch version also bundles its own older TypeScript parser, so
`tsconfig.arch.json` uses conservative options (`target: ES2019`,
`moduleResolution: node`). If the app starts using newer TypeScript syntax, run
`pnpm test:arch` and make sure the files still parse.

Architecture rules are convention-based and dependency-based: a file renamed to
the wrong suffix can escape the intended rule, and the rules do not inspect
runtime behavior. They are a deterministic guardrail, not a proof of design.
