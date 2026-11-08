export type TextRecord = {
  id: string;
  title: string;
  author: string;
  language: string;
  labels: string[];
  content: string;
  collectionId: string | null;
  lastPosition: number;
  coverImage?: string;
};
export type CollectionRecord = {
  id: string;
  title: string;
  itemIds: string[];
  coverImage?: string;
};
export type PracticeMark = {
  id: string;
  itemId: string;
  word: string;
  excerpt: string;
  date: number;
  characterOffset?: number;
};
export type PlayerData = {
  texts: TextRecord[];
  collections: CollectionRecord[];
  marks: PracticeMark[];
  log: Record<string, number>;
};
export type PlayerDataDefaults = Omit<PlayerData, "marks"> & { marks?: PracticeMark[] };

/** Domain aliases used by the player UI. */
export type TextItem = TextRecord;
export type Collection = CollectionRecord;
export type Mark = PracticeMark;

export type PlaybackQueue = { collectionId: string; textIds: string[] };
export type Settings = {
  wpm: number;
  frequency: number;
  volume: number;
  envelope: number;
  shape: number;
  farnsworthWpm: number;
  paragraphPause: number;
  wordGapMultiplier: number;
  stereo: number;
  room: number;
  roomLevel: number;
  phase: number;
  secondFrequency: number;
};
export type Theme = "light" | "dark";
export type ViewName = "player" | "library" | "review" | "log";
export type PlaybackState = "idle" | "preparing" | "playing" | "paused" | "stopping" | "ended";

/** A transcript span in UTF-16 offsets plus audio frame indices. */
export type TextSpan = {
  startText: number;
  endText: number;
  startFrame: number;
  endFrame: number;
};

export type StreamSaverWindow = Window & {
  streamSaver?: {
    supported: boolean;
    mitm: string;
    createWriteStream: (filename: string) => WritableStream<Uint8Array>;
  };
};
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
