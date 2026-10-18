import type { NextRequest } from "next/server";

type RateLimitOptions = {
    windowMs: number;
    max: number;
    keyPrefix?: string;
};

type RateLimitState = {
    count: number;
    resetAt: number;
};

const rateLimitMap = new Map<string, RateLimitState>();

const getClientIp = (req: NextRequest): string => {
    const xForwardedFor = req.headers.get("x-forwarded-for");
    if (xForwardedFor) return xForwardedFor.split(",")[0].trim();

    const xRealIp = req.headers.get("x-real-ip");
    if (xRealIp) return xRealIp.trim();

    const reqWithIp = req as NextRequest & { ip?: string };
    if (typeof reqWithIp.ip === "string" && reqWithIp.ip) return reqWithIp.ip;

    return "unknown";
};

const rateLimit = (req: NextRequest, options: RateLimitOptions) => {
    const ip = getClientIp(req);
    const key = `${options.keyPrefix ?? "ip"}:${ip}`;
    const now = Date.now();

    const existing = rateLimitMap.get(key);

    if (!existing || now > existing.resetAt) {
        const resetAt = now + options.windowMs;
        rateLimitMap.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: options.max - 1, resetAt, key };
    }

    const nextCount = existing.count + 1;
    const allowed = nextCount <= options.max;

    rateLimitMap.set(key, { count: nextCount, resetAt: existing.resetAt });

    return {
        allowed,
        remaining: Math.max(0, options.max - nextCount),
        resetAt: existing.resetAt,
        key
    };
};

export default rateLimit;