import { Schema, model, models, Types } from "mongoose";

export interface ISite {
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
  userId: Types.ObjectId;
  localId?: string;
  synced?: boolean;
}

const SiteSchema = new Schema<ISite>({
  projectType: {
    type: String,
    required: true,
    enum: ["BUILDING", "STREET_LIGHT", "SCHOOL", "COMPOUND", "MOSQUE", "ROAD", "OTHER"],
    default: "BUILDING",
    index: true
  },
  projectName: { type: String, required: true, trim: true, index: true },
  siteNo: { type: String, trim: true, index: true },
  siteName: { type: String, required: true, trim: true, index: true },
  floor: { type: String, trim: true, default: "N/A" },
  roomNo: { type: String, trim: true, default: "N/A" },
  roomType: { type: String, trim: true, index: true },
  areaZone: { type: String, trim: true, index: true },
  locationName: { type: String, trim: true, index: true },
  city: { type: String, trim: true, index: true },
  streetName: { type: String, trim: true },
  poleNo: { type: String, trim: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: false, index: true },
  localId: { type: String, sparse: true, index: true },
  synced: { type: Boolean, default: true },
}, { timestamps: true });

// === INDEXES FOR FAST SEARCH & PAGINATION ===
// Pagination: newest sites first per user
SiteSchema.index({ userId: 1, createdAt: -1 });
// Filter by projectType: BUILDING vs STREET_LIGHT
SiteSchema.index({ userId: 1, projectType: 1 });
// Search: siteName, siteNo, projectName, locationName, city
SiteSchema.index({ siteName: "text", siteNo: "text", projectName: "text", locationName: "text", city: "text" });

export default models.Site || model<ISite>("Site", SiteSchema, "sites");