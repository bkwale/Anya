import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface SessionRecord {
  id: string; // ISO date + module id
  date: string; // YYYY-MM-DD
  moduleId: string;
  moduleTitle: string;
  promptsCompleted: number;
  promptsTotal: number;
  durationSeconds: number;
  completedAt: string; // ISO timestamp
}

interface AnyaDB extends DBSchema {
  sessions: {
    key: string;
    value: SessionRecord;
    indexes: { "by-date": string };
  };
}

let dbInstance: IDBPDatabase<AnyaDB> | null = null;

async function getDb(): Promise<IDBPDatabase<AnyaDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AnyaDB>("anya-db", 1, {
    upgrade(db) {
      const store = db.createObjectStore("sessions", { keyPath: "id" });
      store.createIndex("by-date", "date");
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
 * Get total sessions and prompts completed across all time.
 */
export async function getStats(): Promise<{
  totalSessions: number;
  totalPrompts: number;
  streakDays: number;
}> {
  const db = await getDb();
  const all = await db.getAll("sessions");

  const totalSessions = all.length;
  const totalPrompts = all.reduce((sum, s) => sum + s.promptsCompleted, 0);

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
      // Allow starting from yesterday
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

  return { totalSessions, totalPrompts, streakDays };
}

/**
 * Get today's date string in YYYY-MM-DD format.
 */
export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}
