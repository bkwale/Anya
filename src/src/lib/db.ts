import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface SessionRecord {
  id: string;
  date: string; // YYYY-MM-DD
  moduleId: string;
  moduleTitle: string;
  promptsCompleted: number;
  promptsTotal: number;
  durationSeconds: number;
  completedAt: string; // ISO timestamp
}

export interface RecordingRecord {
  id: string; // date-moduleId-promptId-timestamp
  date: string; // YYYY-MM-DD
  moduleId: string;
  promptId: string;
  promptText: string;
  blob: Blob;
  durationSeconds: number;
  createdAt: string; // ISO timestamp
}

interface AnyaDB extends DBSchema {
  sessions: {
    key: string;
    value: SessionRecord;
    indexes: { "by-date": string };
  };
  recordings: {
    key: string;
    value: RecordingRecord;
    indexes: { "by-date": string; "by-prompt": string };
  };
}

let dbInstance: IDBPDatabase<AnyaDB> | null = null;

async function getDb(): Promise<IDBPDatabase<AnyaDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AnyaDB>("anya-db", 2, {
    upgrade(db, oldVersion) {
      // Version 1: sessions store
      if (oldVersion < 1) {
        const sessionStore = db.createObjectStore("sessions", { keyPath: "id" });
        sessionStore.createIndex("by-date", "date");
      }
      // Version 2: recordings store
      if (oldVersion < 2) {
        const recStore = db.createObjectStore("recordings", { keyPath: "id" });
        recStore.createIndex("by-date", "date");
        recStore.createIndex("by-prompt", "promptId");
      }
    },
  });

  return dbInstance;
}

/**
 * Save a completed practice session.
 */
export async function saveSession(session: SessionRecord): Promise<void> {
  const db = await getDb();
  await db.put("sessions", session);
}

/**
 * Get all sessions for a specific date (YYYY-MM-DD).
 */
export async function getSessionsByDate(date: string): Promise<SessionRecord[]> {
  const db = await getDb();
  return db.getAllFromIndex("sessions", "by-date", date);
}

/**
 * Save a recording to IndexedDB.
 */
export async function saveRecording(recording: RecordingRecord): Promise<void> {
  const db = await getDb();
  await db.put("recordings", recording);
}

/**
 * Get all recordings, most recent first.
 */
export async function getAllRecordings(): Promise<RecordingRecord[]> {
  const db = await getDb();
  const all = await db.getAll("recordings");
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Get recordings for a specific date.
 */
export async function getRecordingsByDate(date: string): Promise<RecordingRecord[]> {
  const db = await getDb();
  const recs = await db.getAllFromIndex("recordings", "by-date", date);
  return recs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Get the most recent recording for each prompt (to show latest attempts).
 */
export async function getLatestRecordingPerPrompt(): Promise<Map<string, RecordingRecord>> {
  const all = await getAllRecordings();
  const map = new Map<string, RecordingRecord>();
  for (const rec of all) {
    // Already sorted newest-first, so first occurrence is latest
    if (!map.has(rec.promptId)) {
      map.set(rec.promptId, rec);
    }
  }
  return map;
}

/**
 * Get unique dates that have recordings, sorted newest first.
 */
export async function getRecordingDates(): Promise<string[]> {
  const all = await getAllRecordings();
  const dates = [...new Set(all.map((r) => r.date))];
  return dates.sort().reverse();
}

/**
 * Get total sessions and prompts completed across all time.
 */
export async function getStats(): Promise<{
  totalSessions: number;
  totalPrompts: number;
  streakDays: number;
  totalRecordings: number;
}> {
  const db = await getDb();
  const all = await db.getAll("sessions");
  const recordings = await db.getAll("recordings");

  const totalSessions = all.length;
  const totalPrompts = all.reduce((sum, s) => sum + s.promptsCompleted, 0);
  const totalRecordings = recordings.length;

  // Calculate streak: consecutive days ending today (or yesterday)
  const uniqueDays = [...new Set(all.map((s) => s.date))].sort().reverse();
  let streakDays = 0;
  const today = new Date();

  for (let i = 0; i < uniqueDays.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split("T")[0];

    if (uniqueDays[i] === expectedStr) {
      streakDays++;
    } else if (i === 0) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      if (uniqueDays[0] === yesterdayStr) {
        streakDays = 1;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return { totalSessions, totalPrompts, streakDays, totalRecordings };
}

/**
 * Get today's date string in YYYY-MM-DD format.
 */
export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}
