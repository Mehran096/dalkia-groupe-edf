import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Site from "@/models/Site";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function findSite(id: string) {
  if (!id) return null;
  try {
    const byId = await Site.findById(id);
    if (byId) return byId;
  } catch {}
  const byLocal = await Site.findOne({ localId: id });
  if (byLocal) return byLocal;
  return await Site.findOne({ _id: id } as never);
}

// GET /api/sites/[id] - single site
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params;
  const site = await findSite(id);
  if (!site) return NextResponse.json({ error: `Site not found ${id}` }, { status: 404 });
  return NextResponse.json(site);
}

// PUT /api/sites/[id] - edit site
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user?.id as string) || "local";

  const site = await findSite(id);
  if (!site) return NextResponse.json({ error: `Site not found ${id}` }, { status: 404 });

  const body = await req.json();

  const updated = await Site.findByIdAndUpdate(
    site._id,
    {
      projectType: body.projectType ?? site.projectType,
      projectName: body.projectName ?? site.projectName,
      siteNo: body.siteNo ?? site.siteNo,
      siteName: body.siteName ?? site.siteName,
      floor: body.floor ?? site.floor,
      roomNo: body.roomNo ?? site.roomNo,
      roomType: body.roomType ?? site.roomType,
      areaZone: body.areaZone ?? site.areaZone,
      locationName: body.locationName ?? site.locationName,
      city: body.city ?? site.city,
      streetName: body.streetName ?? site.streetName,
      poleNo: body.poleNo ?? site.poleNo,
      userId, synced: true,
    },
    { new: true }
  );

  return NextResponse.json(updated);
}

// DELETE /api/sites/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params;
  const site = await findSite(id);
  if (!site) return NextResponse.json({ error: `Site not found ${id}` }, { status: 404 });

  await Site.findByIdAndDelete(site._id);
  return NextResponse.json({ success: true, deletedId: id });
}