import { Schema, model, models, Types } from "mongoose";

export interface ILight {
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
  userId: Types.ObjectId;
  localId?: string;
  synced?: boolean;
}

const LightSchema = new Schema<ILight>({
  lightName: { type: String, required: true, trim: true, index: true },
  wattage: { type: String, required: true, trim: true },
  lightType: { type: String, required: true, trim: true, index: true },
  modelNo: { type: String, required: true, trim: true, index: true },
  brandModelFull: { type: String, trim: true, index: true },
  company: { type: String, trim: true, index: true },
  stockIn: { type: Number, default: 0, min: 0 },
  stockDamage: { type: Number, default: 0, min: 0 },
  stockInstalled: { type: Number, default: 0, min: 0 },
  stockAvailable: { type: Number, default: 0, min: 0 },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: false, index: true },
  localId: { type: String, sparse: true, index: true },
  synced: { type: Boolean, default: true },
}, { timestamps: true });

// === INDEXES FOR FAST SEARCH & PAGINATION ===
// 1. Pagination: newest lights first per user
LightSchema.index({ userId: 1, createdAt: -1 });
// 2. Search: modelNo, lightName, brandModelFull
LightSchema.index({ modelNo: "text", lightName: "text", brandModelFull: "text", company: "text" });
// 3. Stock filter: find lights with available stock
LightSchema.index({ userId: 1, stockAvailable: -1 });

// Auto calculate available stock before save
LightSchema.pre("save", function() {
  this.stockAvailable = (this.stockIn || 0) - (this.stockDamage || 0) - (this.stockInstalled || 0);
});

export default models.Light || model<ILight>("Light", LightSchema);