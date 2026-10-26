import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Light from "@/models/Light";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface LightBody {
  localId?: string;
  lightName?: string;
  wattage?: string;
  lightType?: string;
  modelNo?: string;
  brandModelFull?: string;
  company?: string;
  stockIn?: number;
  stockDamage?: number;
  stockInstalled?: number;
}

export async function GET(req: NextRequest) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || "local";

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") || "200");
  const search = searchParams.get("search") || "";
  const company = searchParams.get("company") || "";

  const filter: Record<string, unknown> = {};
  // allow local user to see own lights, but also fallback
  if (userId !== "local") {
    // if logged in, filter by userId (handles both string and ObjectId)
    filter.$or = [{ userId: userId }, { userId: { $exists: false } }, { localId: { $exists: true } }];
  }
  if (company) filter.company = company;
  if (search) filter.$text = { $search: search };

  const lights = await Light.find(filter)
    .sort(search ? { score: { $meta: "textScore" }, createdAt: -1 } : { createdAt: -1 })
    .limit(limit);

  return NextResponse.json(lights);
}

export async function POST(req: NextRequest) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  const userId = (session?.user?.id as string) || "local";

  const body = (await req.json()) as LightBody;
  const stockIn = Number(body.stockIn) || 0;
  const stockDamage = Number(body.stockDamage) || 0;
  const stockInstalled = Number(body.stockInstalled) || 0;
  const stockAvailable = stockIn - stockDamage - stockInstalled;

  if (body.localId) {
    const existing = await Light.findOne({ localId: body.localId });
    if (existing) {
      const updated = await Light.findOneAndUpdate(
        { localId: body.localId },
        { ...body, stockIn, stockDamage, stockInstalled, stockAvailable, userId, synced: true },
        { new: true }
      );
      return NextResponse.json(updated);
    }
  }

  const light = await Light.create({
    lightName: body.lightName,
    wattage: body.wattage,
    lightType: body.lightType,
    modelNo: body.modelNo,
    brandModelFull: body.brandModelFull,
    company: body.company,
    stockIn, stockDamage, stockInstalled, stockAvailable,
    userId,
    localId: body.localId,
    synced: true,
  });

  return NextResponse.json(light, { status: 201 });
}