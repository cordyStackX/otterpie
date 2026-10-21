import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib";
import { Security } from "@/firewall";

export async function PATCH(params: NextRequest) {
  const auth = await Security(params);
  if (auth?.error) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { email, category, asset } = await params.json();
    if (asset !== undefined && asset !== "BOT" && asset !== "PIE" && asset !== "XLM") {
      return NextResponse.json({ success: false, error: "Choose BOT, PIE, or XLM categories." }, { status: 400 });
    }
    const categoryColumn = asset === "PIE" ? "category_pie" : "category";

    if (typeof email !== "string" || !email || !Array.isArray(category)) {
      return NextResponse.json({ success: false, error: "Invalid Request" }, { status: 400 });
    }

    const invalidColor = category.some((item: unknown) => {
      if (!item || typeof item !== "object") return true;
      const color = (item as Record<string, unknown>).color;
      return color !== undefined && (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color));
    });
    if (invalidColor) {
      return NextResponse.json({ success: false, error: "Category colors must be 6-digit hex values" }, { status: 400 });
    }

    const invalidGoal = category.some((item: unknown) => {
      if (!item || typeof item !== "object") return true;
      const goal = Number((item as Record<string, unknown>).goal ?? 0);
      return !Number.isFinite(goal) || goal < 0;
    });
    if (invalidGoal) {
      return NextResponse.json({ success: false, error: "Category goals must be zero or greater" }, { status: 400 });
    }

    const percentages = category.map((item: unknown) => {
      if (!item || typeof item !== "object") return Number.NaN;
      return Number((item as Record<string, unknown>).percent);
    });

    if (percentages.some((percent: number) => !Number.isFinite(percent) || percent < 0 || percent > 100)) {
      return NextResponse.json(
        { success: false, error: "Each category share must be between 0% and 100%" },
        { status: 400 }
      );
    }

    const totalPercent = percentages.reduce((total: number, percent: number) => total + percent, 0);
    if (totalPercent > 100) {
      return NextResponse.json(
        { success: false, error: "Category shares cannot total more than 100%" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("categories")
      .update({ [categoryColumn]: category })
      .eq("email", email)
      .select("email")
      .maybeSingle();

    if (error) {
      console.error("Supabase Query Error: ", error);
      return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
    }

    if (!data) {
      const { error: insertError } = await supabaseServer
        .from("categories")
        .insert({ email, [categoryColumn]: category });

      if (insertError) {
        console.error("Supabase Insert Error: ", insertError);
        return NextResponse.json({ success: false, error: "Could not save categories" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: "Could not update categories" }, { status: 500 });
  }
}
