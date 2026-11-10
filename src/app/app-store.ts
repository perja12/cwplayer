import { loadPlayerData, savePlayerData } from "../data/storage-client";
import {
  loadSettings,
  loadTheme,
  saveSettings as writeSettings,
  saveTheme as writeTheme,
} from "../data/settings-client";
import { loadSession, saveSession } from "../data/session-client";
import { defaultCollections, defaultSettings, defaultTexts } from "../model/defaults";
import { todayKey } from "../model/format";
import type {
  Collection,
  InstallPromptEvent,
  Mark,
  PlaybackQueue,
  Settings,
  TextItem,
  Theme,
  ViewName,
} from "../model/types";
import { showToast } from "../ui/toast";

export type AppState = {
  texts: TextItem[];
  collections: Collection[];
  marks: Mark[];
  log: Record<string, number>;
  settings: Settings;
  theme: Theme;
  activeTextId: string;
  playbackQueue: PlaybackQueue | null;
  queueIndex: number;
  view: ViewName;
  followVisible: boolean;
  transcriptFollowPaused: boolean;
  frequencyTextId: string;
  expandedCollections: Set<string>;
  installPrompt: InstallPromptEvent | null;
};

export const appStore: AppState = {
  texts: [],
  collections: [],
  marks: [],
  log: {},
  settings: { ...defaultSettings, ...loadSettings() },
  theme: loadTheme(),
  activeTextId: "",
  playbackQueue: null,
  queueIndex: 0,
  view: "player",
  followVisible: true,
  transcriptFollowPaused: false,
  frequencyTextId: "",
  expandedCollections: new Set<string>(),
  installPrompt: null,
};

export function currentItem() {
  return appStore.texts.find((item) => item.id === appStore.activeTextId) ?? appStore.texts[0];
}

export async function hydrateStore() {
  const data = await loadPlayerData({
    texts: defaultTexts,
    collections: defaultCollections,
    marks: [],
    log: {},
  });
  appStore.texts = data.texts;
  appStore.collections = data.collections;
  appStore.marks = data.marks;
  appStore.log = data.log;
  const rememberedText = appStore.texts.find((item) => item.id === loadSession().activeTextId);
  appStore.activeTextId = rememberedText?.id ?? appStore.texts[0]?.id ?? "";
  appStore.frequencyTextId = appStore.activeTextId;
}

/** Select the track that should be restored on the next launch. */
export function setActiveText(id: string) {
  appStore.activeTextId = id;
  saveSession({ activeTextId: id });
}

export function persistLibrary() {
  const snapshot = {
    texts: structuredClone(appStore.texts),
    collections: structuredClone(appStore.collections),
    marks: structuredClone(appStore.marks),
  };
  void savePlayerData(snapshot).catch((error) =>
    showToast(
      `Could not save local data: ${error instanceof Error ? error.message : String(error)}`,
    ),
  );
}

/** Save only the text records, used for frequent listening-position updates. */
export function persistTexts() {
  void savePlayerData({ texts: structuredClone(appStore.texts) }).catch((error) =>
    showToast(
      `Could not save the listening position: ${error instanceof Error ? error.message : String(error)}`,
    ),
  );
}

export function persistLog() {
  void savePlayerData({ log: { ...appStore.log } }).catch((error) =>
    showToast(
      `Could not save listening time: ${error instanceof Error ? error.message : String(error)}`,
    ),
  );
}

export function updateSettings(settings: Settings) {
  appStore.settings = settings;
  writeSettings(settings);
}

export function updateTheme(theme: Theme) {
  appStore.theme = theme;
  writeTheme(theme);
}

export function addListeningTime(seconds: number) {
  const key = todayKey();
  appStore.log[key] = (appStore.log[key] ?? 0) + seconds;
}

export function setInstallPrompt(event: InstallPromptEvent | null) {
  appStore.installPrompt = event;
}
