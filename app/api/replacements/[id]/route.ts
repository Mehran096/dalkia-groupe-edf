import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Replacement from "@/models/Replacement";
import Light from "@/models/Light";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function findReplacement(id: string) {
  if (!id) return null;
  try {
    const byId = await Replacement.findById(id);
    if (byId) return byId;
  } catch {}
  const byLocal = await Replacement.findOne({ localId: id });
  if (byLocal) return byLocal;
  return await Replacement.findOne({ _id: id } as never);
}

async function adjustLightStock(lightId: string, diff: number) {
  if (!lightId || diff === 0) return;
  try {
    const light = await Light.findById(lightId);
    if (!light) return;
    light.stockInstalled = (light.stockInstalled || 0) + diff;
    if (light.stockInstalled < 0) light.stockInstalled = 0;
    light.stockAvailable = (light.stockIn || 0) - (light.stockDamage || 0) - light.stockInstalled;
    await light.save();
  } catch {}
}

// GET /api/replacements/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params;
  const rep = await findReplacement(id);
  if (!rep) return NextResponse.json({ error: `Replacement not found ${id}` }, { status: 404 });
  return NextResponse.json(rep);
}

// PUT /api/replacements/[id] - Edit replacement
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user?.id as string) || "local";

  const rep = await findReplacement(id);
  if (!rep) return NextResponse.json({ error: `Replacement not found ${id}` }, { status: 404 });

  const body = await req.json();

  const oldNewTotal = rep.newTotalLights || 0;

  const oldFixturesQty = body.oldFixturesQty !== undefined ? Number(body.oldFixturesQty) : rep.oldFixturesQty;
  const oldLightsPerFixture = body.oldLightsPerFixture !== undefined ? Number(body.oldLightsPerFixture) : rep.oldLightsPerFixture;
  const newFixturesQty = body.newFixturesQty !== undefined ? Number(body.newFixturesQty) : rep.newFixturesQty;
  const newLightsPerFixture = body.newLightsPerFixture !== undefined ? Number(body.newLightsPerFixture) : rep.newLightsPerFixture;

  const oldTotalLights = oldFixturesQty * oldLightsPerFixture;
  const newTotalLights = newFixturesQty * newLightsPerFixture;

  const updated = await Replacement.findByIdAndUpdate(
    rep._id,
    {
      date: body.date ? new Date(body.date) : rep.date,
      existingWattage: body.existingWattage ?? rep.existingWattage,
      existingFixtureType: body.existingFixtureType ?? rep.existingFixtureType,
      oldFixturesQty, oldLightsPerFixture, oldTotalLights,
      oldLampWattage: body.oldLampWattage ?? rep.oldLampWattage,
      newFixturesQty, newLightsPerFixture, newTotalLights,
      newWattageLabel: body.newWattageLabel ?? rep.newWattageLabel,
      typeOfReplacement: body.typeOfReplacement ?? rep.typeOfReplacement,
      colorTemp: body.colorTemp ?? rep.colorTemp,
      subContractor: body.subContractor ?? rep.subContractor,
      manpower: body.manpower ?? rep.manpower,
      lightingControl: body.lightingControl ?? rep.lightingControl,
      sensorQty: body.sensorQty ?? rep.sensorQty,
      controlledLightsQty: body.controlledLightsQty ?? rep.controlledLightsQty,
      relayQty: body.relayQty ?? rep.relayQty,
      remarks: body.remarks ?? rep.remarks,
      remarkDate: body.remarkDate ?? rep.remarkDate,
      userId, synced: true,
    },
    { new: true }
  );

  // Adjust Light stock if newTotal changed
  const diff = newTotalLights - oldNewTotal;
  if (diff !== 0 && rep.lightId) {
    await adjustLightStock(rep.lightId.toString(), diff);
  }

  return NextResponse.json(updated);
}

// DELETE /api/replacements/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params;

  const rep = await findReplacement(id);
  if (!rep) return NextResponse.json({ error: `Replacement not found ${id}` }, { status: 404 });

  // Rollback stock: Avl = In - Damage - (Installed - deleted)
  if (rep.lightId && rep.newTotalLights) {
    await adjustLightStock(rep.lightId.toString(), -rep.newTotalLights);
  }

  await Replacement.findByIdAndDelete(rep._id);
  return NextResponse.json({ success: true, deletedId: id, rolledBack: rep.newTotalLights || 0 });
}