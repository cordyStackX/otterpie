import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib";
import { Security } from "@/firewall";

const DEFAULT_ICON = "/icons/otters/otter-default.svg";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

type CategoryRule = {
  id: string;
  name: string;
  percent: number;
  goal: number;
  icons: string;
  color: string;
};

// The jsonb comes from the database, so keep only well-formed entries and only
// allow icons from our own /icons folder (never an outside URL).
function cleanCategories(raw: unknown): CategoryRule[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((c) => {
    if (!c || typeof c !== "object") return [];
    const { id, name, percent, goal, icons, color } = c as Record<string, unknown>;

    if (typeof name !== "string" || !name.trim()) return [];

    const pct = Number(percent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return [];
    const target = Number(goal ?? 0);
    if (!Number.isFinite(target) || target < 0) return [];

    return [
      {
        id: typeof id === "string" ? id.trim() : "",
        name: name.trim(),
        percent: pct,
        goal: target,
        icons:
          typeof icons === "string" && icons.startsWith("/icons/")
            ? icons
            : DEFAULT_ICON,
        color:
          typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)
            ? color
            : "#42c7df",
      },
    ];
  });
}

// React needs a unique id per category. Rows saved without one (or with a
// copy-pasted duplicate id) get a stable fallback based on their position.
// New categories should be saved with an id from crypto.randomUUID().
function withUniqueIds(list: CategoryRule[]): CategoryRule[] {
  const seen = new Set<string>();

  return list.map((c, i) => {
    let id = c.id;
    if (!id || seen.has(id)) id = `legacy-${i}`;
    seen.add(id);
    return { ...c, id };
  });
}

export async function POST(params: NextRequest) {
  const auth = await Security(params);
  if (auth?.error) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await params.json();
  const email = body?.email;

  // Paging: 10 categories per page by default
  const limit = Math.min(
    Math.max(Math.floor(Number(body?.limit)) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );

  if (!email) {
    return NextResponse.json({ success: false, error: "Invalid Request" }, { status: 400 });
  }

  try {
    // Only this user's row, and only the jsonb column
    const { data, error } = await supabaseServer
      .from("categories")
      .select("category")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("Supabase Query Error: ", error);
      return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
    }

    // No row yet = no categories yet (not an error)
    const all = withUniqueIds(cleanCategories(data?.category));

    const total = all.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const page = Math.min(Math.max(Math.floor(Number(body?.page)) || 1, 1), totalPages);
    const totalPercent = all.reduce((sum, c) => sum + c.percent, 0);

    return NextResponse.json(
      {
        success: true,
        rules: all.slice((page - 1) * limit, page * limit),
        page,
        limit,
        total,
        totalPages,
        totalPercent, // across ALL pages, not just this one
      },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
  }
}
