import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Light from "@/models/Light";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function findLight(id: string) {
  if (!id) return null;
  try {
    // try Mongo _id first
    const byId = await Light.findById(id);
    if (byId) return byId;
  } catch {
    // id is not ObjectId, ignore
  }
  // fallback localId
  const byLocal = await Light.findOne({ localId: id });
  if (byLocal) return byLocal;
  // fallback _id as string stored
  const byStringId = await Light.findOne({ _id: id } as never);
  return byStringId;
}

// GET /api/lights/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params; // NEXTJS 15 FIX - must await

  const light = await findLight(id);
  if (!light) {
    return NextResponse.json({ error: `Light not found for id ${id}` }, { status: 404 });
  }
  return NextResponse.json(light);
}

// PUT /api/lights/[id] - Edit Damage / Stock
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params; // NEXTJS 15 FIX
  const session = await getServerSession(authOptions);
  const userId = (session?.user?.id as string) || "local";

  const light = await findLight(id);
  if (!light) {
    return NextResponse.json({ error: `Light not found for id ${id}` }, { status: 404 });
  }

  const body = await req.json() as {
    lightName?: string; wattage?: string; lightType?: string;
    modelNo?: string; brandModelFull?: string; company?: string;
    stockIn?: number; stockDamage?: number; stockInstalled?: number;
  };

  const stockIn = body.stockIn !== undefined ? Number(body.stockIn) : (light.stockIn as number);
  const stockDamage = body.stockDamage !== undefined ? Number(body.stockDamage) : (light.stockDamage as number);
  const stockInstalled = body.stockInstalled !== undefined ? Number(body.stockInstalled) : (light.stockInstalled as number);
  const stockAvailable = stockIn - stockDamage - stockInstalled;

  const updated = await Light.findByIdAndUpdate(
    light._id,
    {
      lightName: body.lightName ?? light.lightName,
      wattage: body.wattage ?? light.wattage,
      lightType: body.lightType ?? light.lightType,
      modelNo: body.modelNo ?? light.modelNo,
      brandModelFull: body.brandModelFull ?? light.brandModelFull,
      company: body.company ?? light.company,
      stockIn, stockDamage, stockInstalled, stockAvailable,
      userId, synced: true,
    },
    { new: true }
  );

  return NextResponse.json(updated);
}

// DELETE /api/lights/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params; // NEXTJS 15 FIX

  const light = await findLight(id);
  if (!light) {
    return NextResponse.json({ error: `Light not found for id ${id}` }, { status: 404 });
  }

  await Light.findByIdAndDelete(light._id);
  return NextResponse.json({ success: true, deletedId: id });
}