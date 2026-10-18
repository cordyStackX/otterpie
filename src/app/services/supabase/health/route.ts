"use server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib"; 
import { rateLimit } from "@/firewall"; 
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {

    const rate = rateLimit(req, { windowMs: 60_000, max: 5, keyPrefix: "health" });
    if (!rate.allowed) {
        const retryAfterSeconds = Math.ceil((rate.resetAt - Date.now()) / 1000);
        return NextResponse.json(
            { success: false, error: "Too many requests. Please try again later." },
            { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
        );
    }

    try {

        const { error } = await supabaseServer.auth.getSession();
        if (error) throw error;

        return NextResponse.json(
        { status: "healthy", message: " ==> Supabase connection successful" },
        { status: 200 }
        );
    } catch (err) {
        console.error(" ==> Supabase health check failed:", err);

        return NextResponse.json(
        {
            status: "unhealthy",
            message: "Supabase connection failed",
            error: err instanceof Error ? err.message : "Unknown error"
        },
        { status: 503 }
        );
    }
}