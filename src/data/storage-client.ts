import type { PlayerData, PlayerDataDefaults } from "../model/types";

const DB_NAME = "cw-player-library";
const DB_VERSION = 1;
const STORE = "records";
const DATA_KEYS = ["texts", "collections", "marks", "log"] as const;
type DataKey = (typeof DATA_KEYS)[number];

function openDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in window))
    return Promise.reject(new Error("IndexedDB is unavailable in this browser."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE))
        database.createObjectStore(STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the local library."));
    request.onblocked = () =>
      reject(
        new Error(
          "The local library is busy in another tab. Close the other CW Player tab and retry.",
        ),
      );
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not read local data."));
  });
}

/** Load the v1 database and initialize empty stores with the supplied new-user defaults. */
export async function loadPlayerData(defaults: PlayerDataDefaults): Promise<PlayerData> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE, "readonly");
    const store = transaction.objectStore(STORE);
    const records = await Promise.all(
      DATA_KEYS.map((key) =>
        requestValue<{ key: DataKey; value: unknown } | undefined>(
          store.get(key) as IDBRequest<{ key: DataKey; value: unknown } | undefined>,
        ),
      ),
    );
    const initial: PlayerData = {
      texts: defaults.texts,
      collections: defaults.collections,
      marks: defaults.marks ?? [],
      log: defaults.log,
    };
    const data = Object.fromEntries(
      DATA_KEYS.map((key, index) => [key, records[index]?.value ?? initial[key]]),
    ) as PlayerData;
    const missing = DATA_KEYS.filter((key, index) => records[index] === undefined);
    if (missing.length)
      await savePlayerData(Object.fromEntries(missing.map((key) => [key, data[key]])));
    return data;
  } finally {
    database.close();
  }
}

/** Save only changed data groups, so frequent log updates don't rewrite long text documents. */
export async function savePlayerData(changes: Partial<PlayerData>): Promise<void> {
  const entries = Object.entries(changes).filter(([key]) => DATA_KEYS.includes(key as DataKey));
  if (!entries.length) return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      for (const [key, value] of entries) store.put({ key, value });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Could not save local data."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Saving local data was canceled."));
    });
  } finally {
    database.close();
  }
}
