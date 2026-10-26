import { Schema, model, models } from "mongoose";

export interface IReplacement {
  date: Date;
  siteId: string;
  lightId: string;
  siteLocalId?: string;
  lightLocalId?: string;

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
  localId?: string;
  synced?: boolean;
}

const ReplacementSchema = new Schema<IReplacement>({
  date: { type: Date, default: Date.now, index: true },
  siteId: { type: String, required: true, index: true },
  lightId: { type: String, required: true, index: true },
  siteLocalId: { type: String, index: true },
  lightLocalId: { type: String, index: true },

  existingWattage: String,
  existingFixtureType: String,
  oldFixturesQty: Number,
  oldLightsPerFixture: Number,
  oldTotalLights: Number,
  oldLampWattage: String,

  newFixturesQty: Number,
  newLightsPerFixture: Number,
  newTotalLights: Number,
  newWattageLabel: String,
  typeOfReplacement: String,

  colorTemp: { type: String, default: "6500k" },
  subContractor: { type: String, default: "Ettiqa", index: true },
  manpower: Number,
  lightingControl: String,
  sensorQty: Number,
  controlledLightsQty: Number,
  relayQty: Number,
  remarks: { type: String, index: true },
  remarkDate: String,

  userId: { type: String, required: false, default: "local", index: true },
  localId: { type: String, sparse: true, index: true },
  synced: { type: Boolean, default: true },
}, { timestamps: true });

// === INDEXES FOR FAST SEARCH & PAGINATION ===
// Pagination: newest first per user — MOST IMPORTANT for Replacements list
ReplacementSchema.index({ userId: 1, date: -1 });
// Filter by site: Show all replacements for Building 82
ReplacementSchema.index({ userId: 1, siteId: 1, date: -1 });
// Filter by light: How many ST8A used
ReplacementSchema.index({ userId: 1, lightId: 1, date: -1 });
// Search: subContractor, remarks, wattage
ReplacementSchema.index({ subContractor: "text", remarks: "text", newWattageLabel: "text" });

export default models.Replacement || model<IReplacement>("Replacement", ReplacementSchema);