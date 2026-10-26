import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Site from "@/models/Site";
import Light from "@/models/Light";
import Replacement from "@/models/Replacement";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isStringUserId = typeof session.user.id === "string" && session.user.id.startsWith("local_") ? false : true;
  const userIdString = session.user.id as string;
  const userIdObject = isStringUserId ? new Types.ObjectId(session.user.id) : null;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ? new Date(searchParams.get("from") as string) : new Date(new Date().getFullYear(), 0, 1);
  const to = searchParams.get("to") ? new Date(searchParams.get("to") as string) : new Date();
  const city = searchParams.get("city") || "";
  const projectType = searchParams.get("projectType") || "";

  // Filters — uses your indexes
  const siteFilter: Record<string, unknown> = {};
  const lightFilter: Record<string, unknown> = {};
  const repFilter: Record<string, unknown> = { date: { $gte: from, $lte: to } };

  if (userIdObject) {
    siteFilter.userId = userIdObject;
    lightFilter.userId = userIdObject;
    repFilter.userId = userIdString; // Replacement uses String userId
  } else {
    siteFilter.userId = userIdString;
    lightFilter.userId = userIdString;
    repFilter.userId = userIdString;
  }

  if (city) siteFilter.city = city;
  if (projectType) siteFilter.projectType = projectType;

  // Fast aggregates — uses indexes userId_1_createdAt_-1, userId_1_date_-1
  const [siteCount, lightCount, replacementCount, totalLightsStats, sitesByType, replacementsByContractor, replacementsBySite, stockSummary, recentReplacements] = await Promise.all([
    Site.countDocuments(siteFilter),
    Light.countDocuments(lightFilter),
    Replacement.countDocuments(repFilter),

    // Total old/new lights replaced — uses date index
    Replacement.aggregate([
      { $match: repFilter },
      { $group: { _id: null, totalOld: { $sum: "$oldTotalLights" }, totalNew: { $sum: "$newTotalLights" }, totalJobs: { $sum: 1 } } }
    ]),

    // Sites by projectType — uses userId_1_projectType_1 index
    Site.aggregate([
      { $match: siteFilter },
      { $group: { _id: "$projectType", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),

    // Replacements by subContractor — uses subContractor text index + userId_1_date_-1
    Replacement.aggregate([
      { $match: repFilter },
      { $group: { _id: "$subContractor", totalFixtures: { $sum: "$newFixturesQty" }, totalLights: { $sum: "$newTotalLights" }, jobs: { $sum: 1 } } },
      { $sort: { totalLights: -1 } },
      { $limit: 10 }
    ]),

    // Top sites by replacement count
    Replacement.aggregate([
      { $match: repFilter },
      { $group: { _id: "$siteId", totalLights: { $sum: "$newTotalLights" }, jobs: { $sum: 1 } } },
      { $sort: { jobs: -1 } },
      { $limit: 10 }
    ]),

    // Stock summary — uses company index
    Light.aggregate([
      { $match: lightFilter },
      { $group: { _id: null, totalIn: { $sum: "$stockIn" }, totalDamage: { $sum: "$stockDamage" }, totalInstalled: { $sum: "$stockInstalled" }, totalAvailable: { $sum: "$stockAvailable" } } }
    ]),

    // Recent 20 — uses userId_1_date_-1 index
    Replacement.find(repFilter).sort({ date: -1 }).limit(20).lean()
  ]);

  // Resolve top site names
  const topSiteIds = replacementsBySite.map((r: { _id: string }) => r._id).filter(Boolean);
  const topSites = topSiteIds.length ? await Site.find({ _id: { $in: topSiteIds } }).select("siteName siteNo").lean() : [];
  const siteMap = new Map(topSites.map((s: { _id: Types.ObjectId; siteName: string; siteNo: string }) => [s._id.toString(), `${s.siteName} (${s.siteNo})`]));

  return NextResponse.json({
    range: { from, to },
    kpi: {
      sites: siteCount,
      lights: lightCount,
      replacements: replacementCount,
      totalOldLights: totalLightsStats[0]?.totalOld || 0,
      totalNewLights: totalLightsStats[0]?.totalNew || 0,
      stockIn: stockSummary[0]?.totalIn || 0,
      stockDamage: stockSummary[0]?.totalDamage || 0,
      stockInstalled: stockSummary[0]?.totalInstalled || 0,
      stockAvailable: stockSummary[0]?.totalAvailable || 0,
    },
    breakdown: {
      sitesByType,
      byContractor: replacementsByContractor,
      bySite: replacementsBySite.map((r: { _id: string; totalLights: number; jobs: number }) => ({
        siteId: r._id,
        siteName: siteMap.get(r._id) || r._id.slice(0, 12),
        totalLights: r.totalLights,
        jobs: r.jobs
      })),
    },
    recent: recentReplacements
  });
}