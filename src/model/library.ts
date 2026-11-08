import type { Collection, PlaybackQueue, TextItem } from "./types";

export function describeItem(
  item: TextItem | undefined,
  queue: PlaybackQueue | null,
  collections: Collection[],
  queueIndex: number,
) {
  if (queue) {
    const collection = collections.find((entry) => entry.id === queue.collectionId);
    if (collection)
      return `${collection.title} · Chapter ${queueIndex + 1} of ${queue.textIds.length}`;
  }
  return item ? item.author || item.language || "Morse practice" : "CW Player";
}

export function assignedCollection(collections: Collection[], item: TextItem) {
  return collections.find(
    (entry) => entry.id === item.collectionId || entry.itemIds.includes(item.id),
  );
}

export type TextDraft = {
  title: string;
  content: string;
  language: string;
  labels: string[];
  collectionId: string | null;
};

export type TextForm = Pick<FormData, "get">;

const stringEntry = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

/**
 * Validate and normalize the add/edit text form. A draft exists only when both
 * a title and content were supplied after trimming.
 */
export function textDraftFromFormData(form: TextForm): TextDraft | null {
  const title = stringEntry(form.get("title")).trim();
  const content = stringEntry(form.get("content")).trim();
  if (!title || !content) return null;
  return {
    title,
    content,
    language: stringEntry(form.get("language")),
    labels: stringEntry(form.get("labels"))
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean),
    collectionId: stringEntry(form.get("collection")) || null,
  };
}

/** Collection text ids restricted to texts that still exist, in queue order. */
export function playableQueueTextIds(itemIds: readonly string[], availableIds: readonly string[]) {
  const available = new Set(availableIds);
  return itemIds.filter((id) => available.has(id));
}

export type QueueEdit = { queue: PlaybackQueue | null; queueIndex: number };

/**
 * Remove a text from a playback queue. Removing the current chapter clears the
 * queue; removing an earlier chapter keeps the listener on the same text by
 * shifting the index down.
 */
export function removeQueuedText(
  queue: PlaybackQueue | null,
  queueIndex: number,
  textId: string,
): QueueEdit {
  if (!queue) return { queue, queueIndex };
  const removedIndex = queue.textIds.indexOf(textId);
  if (removedIndex < 0) return { queue, queueIndex };
  if (removedIndex === queueIndex) return { queue: null, queueIndex };
  return {
    queue: { ...queue, textIds: queue.textIds.filter((id) => id !== textId) },
    queueIndex: removedIndex < queueIndex ? queueIndex - 1 : queueIndex,
  };
}
