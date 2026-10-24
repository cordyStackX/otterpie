"use server";
import {  NextResponse, NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { supabaseServer } from "@/lib"; 
import { cookies } from "next/headers";
// import api_link from "@/config/conf/json_config/Api_links.json";

type RetryState = {
    count: number;
    windowStart: number;
};

// Retry tracking per session + IP (shared across all routes)
const retryMap = new Map<string, RetryState>();
const MAX_RETRIES = 50;
const RETRY_WINDOW_MS = 60_000;

function toOrigin(url: string | null): string | null {
    if (!url) return null;
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

function forwardedRequestOrigin(req: NextRequest): string | null {
    const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0].trim();
    const host = forwardedHost || req.headers.get("host");
    if (!host) return null;
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
    const proto = forwardedProto || req.nextUrl.protocol.replace(":", "");
    if (proto !== "http" && proto !== "https") return null;
    return toOrigin(`${proto}://${host}`);
}

function normalizeIp(req: NextRequest): string {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return req.headers.get("x-real-ip") || "unknown";
}

function isAllowedRequestOrigin(req: NextRequest): boolean {
    const requestOrigin = toOrigin(req.headers.get("origin"));
    const refererOrigin = toOrigin(req.headers.get("referer"));

    const allowedOrigins = new Set([
        process.env.NEXT_PUBLIC_APP_URL,
        "http://localhost:3000",
        "https://localhost:3000",
        req.nextUrl.origin,
        forwardedRequestOrigin(req),
    ].filter(Boolean) as string[]);

    if (requestOrigin && allowedOrigins.has(requestOrigin)) return true;
    if (refererOrigin && allowedOrigins.has(refererOrigin)) return true;

    return false;
}

function cleanupRetryMap(now: number) {
    if (retryMap.size <= 2000) return;
    const cutoff = now - (RETRY_WINDOW_MS * 2);
    for (const [key, value] of retryMap.entries()) {
        if (value.windowStart < cutoff) {
            retryMap.delete(key);
        }
    }
}

export default async function Security(req: NextRequest) {

    const isWeb = req.headers.get("origin") || req.headers.get("referer");

    if (isWeb && !isAllowedRequestOrigin(req)) {
        return {
            error: NextResponse.json({ error: "CSRF blocked" }, { status: 410 }),
        };
    }

  
    try {
        const authHeader = req.headers.get("authorization");
        const bearerToken = authHeader?.startsWith("Bearer ")
            ? authHeader.replace("Bearer ", "")
            : null;

        const cookieToken = (await cookies()).get("token")?.value;

        const token = bearerToken || cookieToken;

        if (!token) {
            return {
                error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
            };
        }

        const ip = normalizeIp(req);
        const sessionKey = `${token.slice(0, 24)}:${ip}`;
        const now = Date.now();
        const currentRetryState = retryMap.get(sessionKey);

        if (!currentRetryState || now - currentRetryState.windowStart > RETRY_WINDOW_MS) {
            retryMap.set(sessionKey, { count: 1, windowStart: now });
        } else {
            const nextCount = currentRetryState.count + 1;
            if (nextCount > MAX_RETRIES) {
                return {
                    error: NextResponse.json(
                        { error: "Too many requests. Please try again after a minute." },
                        { status: 429 }
                    ),
                };
            }
            retryMap.set(sessionKey, { ...currentRetryState, count: nextCount });
        }

        cleanupRetryMap(now);

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            email?: unknown;
            data?: { email?: unknown; network?: unknown };
            final_data?: { email?: unknown };
        };
        // auth_jwt stores the session identity inside `data`; older sessions
        // and other token issuers may put it at the top level or `final_data`.
        const email = [decoded.email, decoded.data?.email, decoded.final_data?.email]
            .find((value): value is string => typeof value === "string" && value.trim().length > 0)
            ?.trim();

        if (!email) {
            return {
                error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
            };
        }

        const { data: account, error } = await supabaseServer
        .from("tbl_auth")
        .select("email, status")
        .eq("email", email)
        .maybeSingle();

        if (error || !account) {
            return {
                error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
            };
        }

        const sessionNetwork = decoded.data?.network;
        const network = sessionNetwork === "stellar" || sessionNetwork === "stellar_testnet"
            ? (account.status === 0 ? "stellar_testnet" : "stellar")
            : sessionNetwork;

        return { error: false, email: account.email, network };

    } catch (err) {
        console.error("Security error:", err);
        return {
        error: NextResponse.json({ error: "Unauthorized" }, { status: 500 }),
        };
    }
}
