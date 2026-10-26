import { db, type OfflineSite, type OfflineLight, type OfflineReplacement } from "./offline-db";

type SyncTableName = "sites" | "lights" | "replacements";
type SyncRecord = OfflineSite | OfflineLight | OfflineReplacement;

interface ApiResponse {
  _id?: string;
  data?: { _id: string };
  localId?: string;
}

interface ApiListResponse {
  data?: unknown[];
}

const getEndpoint = (table: SyncTableName): string => {
  if (table === "sites") return "/api/sites";
  if (table === "lights") return "/api/lights";
  return "/api/replacements";
};

const isUnsynced = (r: SyncRecord): boolean => {
  return r.synced === false;
};

const getUnsyncedRecords = async (table: SyncTableName): Promise<SyncRecord[]> => {
  // Use index on synced — fast query, no full scan
  try {
    if (table === "sites") {
      const result = await db.sites.where("synced").equals(0).toArray();
      if (result.length > 0) return result;
      const resultBool = await db.sites.where("synced").equals(false as unknown as string).toArray();
      if (resultBool.length > 0) return resultBool;
    } else if (table === "lights") {
      const result = await db.lights.where("synced").equals(0).toArray();
      if (result.length > 0) return result;
      const resultBool = await db.lights.where("synced").equals(false as unknown as string).toArray();
      if (resultBool.length > 0) return resultBool;
    } else {
      const result = await db.replacements.where("synced").equals(0).toArray();
      if (result.length > 0) return result;
      const resultBool = await db.replacements.where("synced").equals(false as unknown as string).toArray();
      if (resultBool.length > 0) return resultBool;
    }
  } catch {
    // fallback below
  }

  const all = await db[table].toArray() as SyncRecord[];
  return all.filter(isUnsynced);
};

const syncTable = async (table: SyncTableName): Promise<void> => {
  const unsynced = await getUnsyncedRecords(table);
  if (unsynced.length === 0) return;

  for (const item of unsynced) {
    try {
      const endpoint = getEndpoint(table);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });

      if (res.ok) {
        const saved = (await res.json()) as ApiResponse;
        const serverId = saved._id ?? saved.data?._id ?? saved.localId;

        if (table === "sites") {
          if (serverId) await db.sites.update(item.localId, { synced: true, _id: serverId });
          else await db.sites.update(item.localId, { synced: true });
        } else if (table === "lights") {
          if (serverId) await db.lights.update(item.localId, { synced: true, _id: serverId });
          else await db.lights.update(item.localId, { synced: true });
        } else {
          if (serverId) await db.replacements.update(item.localId, { synced: true, _id: serverId });
          else await db.replacements.update(item.localId, { synced: true });
        }
      }
    } catch (error) {
      console.log(`Sync failed for ${table} ${item.localId}`, error);
    }
  }
};

export const syncAll = async (): Promise<void> => {
  if (typeof navigator === "undefined" || !navigator.onLine) return;
  await syncTable("sites");
  await syncTable("lights");
  await syncTable("replacements");
};

const extractArray = (json: unknown): unknown[] => {
  if (Array.isArray(json)) return json;
  if (typeof json === "object" && json !== null) {
    const obj = json as ApiListResponse;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
};

export const fetchAndCache = async (): Promise<void> => {
  if (typeof navigator === "undefined" || !navigator.onLine) return;

  try {
    const [sitesRes, lightsRes, replacementsRes] = await Promise.all([
      fetch("/api/sites"),
      fetch("/api/lights"),
      fetch("/api/replacements"),
    ]);

    if (sitesRes.ok) {
      const json: unknown = await sitesRes.json();
      const list = extractArray(json) as OfflineSite[];
      const toPut = list
        .filter((s) => Boolean(s.localId || s._id))
        .map((s) => ({ ...s, localId: s.localId || (s._id as string), synced: true }));
      if (toPut.length > 0) await db.sites.bulkPut(toPut);
    }

    if (lightsRes.ok) {
      const json: unknown = await lightsRes.json();
      const list = extractArray(json) as OfflineLight[];
      const toPut = list
        .filter((l) => Boolean(l.localId || l._id))
        .map((l) => ({ ...l, localId: l.localId || (l._id as string), synced: true }));
      if (toPut.length > 0) await db.lights.bulkPut(toPut);
    }

    if (replacementsRes.ok) {
      const json: unknown = await replacementsRes.json();
      const list = extractArray(json) as OfflineReplacement[];
      const toPut = list
        .filter((r) => Boolean(r.localId || r._id))
        .map((r) => ({ ...r, localId: r.localId || (r._id as string), synced: true }));
      if (toPut.length > 0) await db.replacements.bulkPut(toPut);
    }
  } catch (error) {
    console.log("Fetch cache failed", error);
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void syncAll();
  });
}