export type Dependency = { source: string; target: string };

/**
 * Select every TypeScript file that does not match any of the given patterns.
 * Each pattern becomes a negative lookahead so rules stay declarative.
 */
export function anyFileExcept(...patterns: string[]): string {
  return String.raw`^${patterns.map((pattern) => `(?!.*${pattern})`).join("")}.*\.ts$`;
}

export function toDependency(violation: unknown): Dependency {
  const { dependency } = violation as {
    dependency: { sourceLabel: string; targetLabel: string };
  };
  return { source: dependency.sourceLabel, target: dependency.targetLabel };
}

export function formatDependency(dependency: Dependency) {
  return `${dependency.source} -> ${dependency.target}`;
}

export function formatViolations(violations: readonly unknown[]) {
  return violations.map(toDependency).map(formatDependency).sort();
}
