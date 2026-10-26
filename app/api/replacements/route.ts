import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Replacement from "@/models/Replacement";
import Site from "@/models/Site";
import Light from "@/models/Light";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReplacementBody = {
  localId?: string;
  siteId: string;
  lightId: string;
  date?: string;
  existingWattage?: string;
  existingFixtureType?: string;
  oldFixturesQty?: number;
  oldLightsPerFixture?: number;
  oldLampWattage?: string;
  newFixturesQty?: number;
  newLightsPerFixture?: number;
  newWattageLabel?: string;
  typeOfReplacement?: string;
  colorTemp?: string;
  subContractor?: string;
  manpower?: number;
  lightingControl?: string;
  sensorQty?: number;
  controlledLightsQty?: number;
  relayQty?: number;
  remarks?: string;
  remarkDate?: string;
};

async function resolveSiteId(inputId: string, userId: string): Promise<{ mongoId: string; localId?: string } | null> {
  if (!inputId) return null;
  try {
    const byId = await Site.findById(inputId);
    if (byId) return { mongoId: byId._id.toString(), localId: byId.localId as string | undefined };
  } catch {}
  const byLocal = await Site.findOne({ localId: inputId });
  if (byLocal) return { mongoId: byLocal._id.toString(), localId: byLocal.localId as string };
  if (userId !== "local") {
    const byLocalUser = await Site.findOne({ localId: inputId, userId });
    if (byLocalUser) return { mongoId: byLocalUser._id.toString(), localId: byLocalUser.localId as string };
  }
  return null;
}

async function resolveLightId(inputId: string, userId: string): Promise<{ mongoId: string; localId?: string } | null> {
  if (!inputId) return null;
  try {
    const byId = await Light.findById(inputId);
    if (byId) return { mongoId: byId._id.toString(), localId: byId.localId as string | undefined };
  } catch {}
  const byLocal = await Light.findOne({ localId: inputId });
  if (byLocal) return { mongoId: byLocal._id.toString(), localId: byLocal.localId as string };
  if (userId !== "local") {
    const byLocalUser = await Light.findOne({ localId: inputId, userId });
    if (byLocalUser) return { mongoId: byLocalUser._id.toString(), localId: byLocalUser.localId as string };
  }
  return null;
}

export async function GET(req: NextRequest) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  const userId = (session?.user?.id as string) || "local";

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "200");
  const search = searchParams.get("search") || "";
  const siteIdFilter = searchParams.get("siteId") || "";

  const filter: Record<string, unknown> = {};
  if (userId !== "local") filter.userId = userId;

  if (siteIdFilter) {
    const resolved = await resolveSiteId(siteIdFilter, userId);
    filter.siteId = resolved ? resolved.mongoId : siteIdFilter;
  }

  // Vercel safe search: try text, fallback to no search (frontend does real search)
  if (search) {
    try {
      filter.$text = { $search: search };
    } catch {
      // ignore if no index
    }
  }

  const skip = (page - 1) * limit;
  let replacements;
  try {
    replacements = await Replacement.find(filter)
      .sort(search ? { score: { $meta: "textScore" }, date: -1 } : { date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  } catch {
    // if $text fails (no index), retry without text
    delete filter.$text;
    replacements = await Replacement.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean();
  }

  return NextResponse.json(replacements);
}

export async function POST(req: NextRequest) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  const userId = (session?.user?.id as string) || "local";

  const body = (await req.json()) as ReplacementBody;

  const oldFixturesQty = Number(body.oldFixturesQty) || 0;
  const oldLightsPerFixture = Number(body.oldLightsPerFixture) || 0;
  const newFixturesQty = Number(body.newFixturesQty) || 0;
  const newLightsPerFixture = Number(body.newLightsPerFixture) || 0;

  const oldTotalLights = oldFixturesQty * oldLightsPerFixture;
  const newTotalLights = newFixturesQty * newLightsPerFixture;

  const rawSiteId = body.siteId;
  const rawLightId = body.lightId;

  if (body.localId) {
    const existing = await Replacement.findOne({ localId: body.localId });
    if (existing) {
      const updated = await Replacement.findOneAndUpdate(
        { localId: body.localId },
        { ...body, oldTotalLights, newTotalLights, userId, synced: true },
        { new: true }
      );
      return NextResponse.json(updated);
    }
  }

  const resolvedSite = await resolveSiteId(rawSiteId, userId);
  const resolvedLight = await resolveLightId(rawLightId, userId);

  if (!resolvedSite) {
    return NextResponse.json({ error: `Site not found for id ${rawSiteId}. Sync sites first.` }, { status: 400 });
  }
  if (!resolvedLight) {
    return NextResponse.json({ error: `Light not found for id ${rawLightId}. Sync lights first.` }, { status: 400 });
  }

  const replacement = await Replacement.create({
    date: body.date ? new Date(body.date) : new Date(),
    siteId: resolvedSite.mongoId,
    lightId: resolvedLight.mongoId,
    siteLocalId: resolvedSite.localId || (rawSiteId.startsWith("local_") ? rawSiteId : undefined),
    lightLocalId: resolvedLight.localId || (rawLightId.startsWith("local_") ? rawLightId : undefined),
    existingWattage: body.existingWattage,
    existingFixtureType: body.existingFixtureType,
    oldFixturesQty,
    oldLightsPerFixture,
    oldTotalLights,
    oldLampWattage: body.oldLampWattage,
    newFixturesQty,
    newLightsPerFixture,
    newTotalLights,
    newWattageLabel: body.newWattageLabel,
    typeOfReplacement: body.typeOfReplacement,
    colorTemp: body.colorTemp,
    subContractor: body.subContractor,
    manpower: body.manpower,
    lightingControl: body.lightingControl,
    sensorQty: body.sensorQty,
    controlledLightsQty: body.controlledLightsQty,
    relayQty: body.relayQty,
    remarks: body.remarks,
    remarkDate: body.remarkDate,
    userId,
    localId: body.localId,
    synced: true,
  });

  if (newTotalLights > 0) {
    try {
      const light = await Light.findById(resolvedLight.mongoId);
      if (light) {
        light.stockInstalled = (light.stockInstalled || 0) + newTotalLights;
        light.stockAvailable = (light.stockIn || 0) - (light.stockDamage || 0) - light.stockInstalled;
        await light.save();
      }
    } catch {}
  }

  return NextResponse.json(replacement, { status: 201 });
}