import Dexie, { type Table } from "dexie";

export interface OfflineSite {
  localId: string;
  projectType: string;
  projectName: string;
  siteNo: string;
  siteName: string;
  floor: string;
  roomNo: string;
  roomType: string;
  areaZone: string;
  locationName: string;
  city: string;
  streetName?: string;
  poleNo?: string;
  userId: string;
  synced: boolean;
  _id?: string;
}

export interface OfflineLight {
  localId: string;
  lightName: string;
  wattage: string;
  lightType: string;
  modelNo: string;
  brandModelFull: string;
  company: string;
  stockIn: number;
  stockDamage: number;
  stockInstalled: number;
  stockAvailable: number;
  userId: string;
  synced: boolean;
  _id?: string;
}

export interface OfflineReplacement {
  localId: string;
  date: Date;
  siteId: string;
  lightId: string;
  existingWattage: string;
  existingFixtureType: string;
  oldFixturesQty: number;
  oldLightsPerFixture: number;
  oldTotalLights: number;
  oldLampWattage: string;
  newFixturesQty: number;
  newLightsPerFixture: number;
  newTotalLights: number;
  newWattageLabel: string;
  typeOfReplacement: string;
  colorTemp: string;
  subContractor: string;
  manpower: number;
  lightingControl: string;
  sensorQty: number;
  controlledLightsQty: number;
  relayQty: number;
  remarks: string;
  remarkDate: string;
  userId: string;
  synced: boolean;
  _id?: string;
}

export interface OfflineUser {
  _id: string;
  email: string;
  name: string;
}

class LightingDB extends Dexie {
  sites!: Table<OfflineSite, string>;
  lights!: Table<OfflineLight, string>;
  replacements!: Table<OfflineReplacement, string>;
  users!: Table<OfflineUser, string>;

  constructor() {
    super("dalkia-lighting-pwa");
    // v1 keep for migration, v2 = optimized indexes for search + pagination
    this.version(1).stores({
      sites: "localId, siteName, siteNo, projectType, projectName, synced, _id",
      lights: "localId, lightName, modelNo, wattage, synced, _id",
      replacements: "localId, siteId, lightId, date, synced, _id",
      users: "_id, email",
    });

    this.version(2).stores({
      sites: "localId, *siteName, *projectName, siteNo, projectType, city, synced, _id",
      lights: "localId, *lightName, *modelNo, *brandModelFull, company, synced, _id",
      replacements: "localId, siteId, lightId, date, userId, synced, _id",
      users: "_id, email",
    }).upgrade(tx => {
      // Dexie auto migrates data
      return tx.table("sites").toCollection().modify(() => {});
    });
  }
}

export const db = new LightingDB();

export const generateLocalId = (): string => {
  return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

type OfflineTableData = OfflineSite | OfflineLight | OfflineReplacement;

export const addToOffline = async <T extends OfflineTableData>(
  table: "sites" | "lights" | "replacements",
  data: T
): Promise<T> => {
  const localId = data.localId || generateLocalId();
  const item = { ...data, localId, synced: false } as T;
  await db[table].put(item as unknown as OfflineSite & OfflineLight & OfflineReplacement);
  return item;
};