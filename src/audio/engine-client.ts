let engineModule: WebAssembly.Module | null = null;

async function compileEngine() {
  const response = await fetch("/engine/cwtone.wasm");
  if (!response.ok) throw new Error("Morse engine is not built. Run pnpm build:wasm first.");
  return WebAssembly.compile(await response.arrayBuffer());
}

export async function getEngineModule() {
  engineModule ??= await compileEngine();
  return engineModule;
}

export function cachedEngineModule() {
  return engineModule;
}
