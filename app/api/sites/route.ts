import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Site from "@/models/Site";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SiteBody {
  localId?: string;
  projectType?: string;
  projectName?: string;
  siteNo?: string;
  siteName?: string;
  floor?: string;
  roomNo?: string;
  roomType?: string;
  areaZone?: string;
  locationName?: string;
  city?: string;
  streetName?: string;
  poleNo?: string;
}

export async function GET(req: NextRequest) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || "local";

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") || "200");
  const search = searchParams.get("search") || "";
  const projectType = searchParams.get("projectType") || "";
  const city = searchParams.get("city") || "";

  const filter: Record<string, unknown> = {};
  if (projectType) filter.projectType = projectType;
  if (city) filter.city = city;
  if (search) filter.$text = { $search: search };

  // if logged in, try filter by user, else return all (for warehouse local)
  if (userId !== "local") {
    // allow both string id and ObjectId forms
    filter.$or = [{ userId: userId }, { userId: { $exists: false } }] as never;
  }

  const sites = await Site.find(filter)
    .sort(search ? { score: { $meta: "textScore" }, createdAt: -1 } : { createdAt: -1 })
    .limit(limit);

  return NextResponse.json(sites);
}

export async function POST(req: NextRequest) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  const userId = (session?.user?.id as string) || "local";

  const body = (await req.json()) as SiteBody;

  if (body.localId) {
    const existing = await Site.findOne({ localId: body.localId });
    if (existing) {
      const updated = await Site.findOneAndUpdate(
        { localId: body.localId },
        { ...body, userId, synced: true },
        { new: true }
      );
      return NextResponse.json(updated);
    }
  }

  const site = await Site.create({
    projectType: body.projectType,
    projectName: body.projectName,
    siteNo: body.siteNo,
    siteName: body.siteName,
    floor: body.floor,
    roomNo: body.roomNo,
    roomType: body.roomType,
    areaZone: body.areaZone,
    locationName: body.locationName,
    city: body.city,
    streetName: body.streetName,
    poleNo: body.poleNo,
    userId,
    localId: body.localId,
    synced: true,
  });

  return NextResponse.json(site, { status: 201 });
}