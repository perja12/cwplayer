import { filesOfProject } from "tsarch";
import { describe, expect, it } from "vitest";
import { anyFileExcept, formatViolations } from "./utils";

const TS_CONFIG = "tsconfig.arch.json";

// Building blocks are recognized by suffix, so a rename cannot silently move
// a file into a different architectural layer.
const VIEW = String.raw`-view\.ts$`;
const STORE = String.raw`-store\.ts$`;
const CLIENT = String.raw`-client\.ts$`;

const FORBIDDEN_FOR_VIEWS = String.raw`(-(controller|client)\.ts$|/controllers/|/data/|/audio/)`;
const FORBIDDEN_FOR_STORES = String.raw`(-(view|controller)\.ts$|/views/|/controllers/|/audio/)`;
const FORBIDDEN_FOR_CLIENTS = String.raw`(-(view|controller|store)\.ts$|/views/|/controllers/|/audio/|/app/|/ui/)`;
const FORBIDDEN_FOR_UI = String.raw`(/app/|/controllers/|/data/|/audio/|/views/)`;
const FORBIDDEN_FOR_DATA = String.raw`(/app/|/controllers/|/audio/|/ui/|/views/)`;
const FORBIDDEN_FOR_AUDIO = String.raw`(/views/|/controllers/|app-controller\.ts$|bootstrap\.ts$)`;
const FORBIDDEN_FOR_MAIN = String.raw`(/views/|/controllers/|/audio/|/data/|-(view|controller|store|client)\.ts$)`;

describe("architecture: pure model", () => {
  it("models do not depend on UI, data, audio, or orchestration", async () => {
    const rule = filesOfProject(TS_CONFIG)
      .inFolder("model")
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(anyFileExcept("/model/"));

    expect(formatViolations(await rule.check())).toEqual([]);
  });
});

describe("architecture: presentation", () => {
  it("view-suffixed files do not depend on controllers, clients, data, or audio", async () => {
    const rule = filesOfProject(TS_CONFIG)
      .matchingPattern(VIEW)
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(FORBIDDEN_FOR_VIEWS);

    expect(formatViolations(await rule.check())).toEqual([]);
  });

  it("everything under views/ also follows the view boundary", async () => {
    const rule = filesOfProject(TS_CONFIG)
      .inFolder("views")
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(FORBIDDEN_FOR_VIEWS);

    expect(formatViolations(await rule.check())).toEqual([]);
  });

  it("UI primitives do not depend on application layers", async () => {
    const rule = filesOfProject(TS_CONFIG)
      .inFolder("ui")
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(FORBIDDEN_FOR_UI);

    expect(formatViolations(await rule.check())).toEqual([]);
  });
});

describe("architecture: state and infrastructure", () => {
  it("stores do not depend on views, controllers, or audio", async () => {
    const rule = filesOfProject(TS_CONFIG)
      .matchingPattern(STORE)
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(FORBIDDEN_FOR_STORES);

    expect(formatViolations(await rule.check())).toEqual([]);
  });

  it("clients do not depend on views, controllers, stores, audio, or UI", async () => {
    const rule = filesOfProject(TS_CONFIG)
      .matchingPattern(CLIENT)
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(FORBIDDEN_FOR_CLIENTS);

    expect(formatViolations(await rule.check())).toEqual([]);
  });

  it("data clients do not depend on orchestration", async () => {
    const rule = filesOfProject(TS_CONFIG)
      .inFolder("data")
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(FORBIDDEN_FOR_DATA);

    expect(formatViolations(await rule.check())).toEqual([]);
  });
});

describe("architecture: audio", () => {
  it("audio code does not depend on views or feature controllers", async () => {
    const rule = filesOfProject(TS_CONFIG)
      .inFolder("audio")
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(FORBIDDEN_FOR_AUDIO);

    expect(formatViolations(await rule.check())).toEqual([]);
  });
});

describe("architecture: composition root", () => {
  it("only the bootstrap may depend on the app controller", async () => {
    const rule = filesOfProject(TS_CONFIG)
      .matchingPattern(anyFileExcept("/app/bootstrap.ts"))
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(String.raw`app-controller\.ts$`);

    expect(formatViolations(await rule.check())).toEqual([]);
  });

  it("feature code does not depend on the bootstrap", async () => {
    const rule = filesOfProject(TS_CONFIG)
      .matchingPattern(anyFileExcept("/app/bootstrap.ts", String.raw`main\.ts$`))
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(String.raw`bootstrap\.ts$`);

    expect(formatViolations(await rule.check())).toEqual([]);
  });

  it("main.ts only bootstraps the application", async () => {
    const rule = filesOfProject(TS_CONFIG)
      .matchingPattern(String.raw`^src/main\.ts$`)
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(FORBIDDEN_FOR_MAIN);

    expect(formatViolations(await rule.check())).toEqual([]);
  });
});

describe("architecture: dependency graph", () => {
  it("the source tree is free of cycles", async () => {
    const rule = filesOfProject(TS_CONFIG).inFolder("src").should().beFreeOfCycles();

    expect(formatViolations(await rule.check())).toEqual([]);
  });
});
