export type ExportName = `${string}.mp3`;

/** Turn a text title into a safe streamed-download filename. */
export function mp3FileName(title: string): ExportName {
  const safeName = title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "cw-practice";
  return `${safeName}.mp3`;
}
