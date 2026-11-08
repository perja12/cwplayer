export type SelectionPreview = { text: string; playing: boolean };
export type PhrasePreview = { id: string; text: string; playing: boolean };

export type PreviewSnapshot = {
  word: string | null;
  selection: SelectionPreview | null;
  phrase: PhrasePreview | null;
  /** Monotonic token used to discard stale worker results. */
  request: number;
};

export const previewStore: PreviewSnapshot = {
  word: null,
  selection: null,
  phrase: null,
  request: 0,
};
