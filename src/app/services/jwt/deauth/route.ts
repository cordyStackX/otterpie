import { NextResponse } from "next/server";

export async function POST() {
  
    const res = NextResponse.json({ success: true, message: "Logged out" });

    const apikey = process.env.API_KEY;

    if (!apikey) return NextResponse.json({ success: false, error: "API is not Valid" }, { status: 401 });

    res.cookies.set({
        name: "token", 
        value: "",        
        httpOnly: true,
        secure: process.env.PRODUCTION === "production",
        sameSite: "strict",
        path: "/",        
        maxAge: 0, 
    });

    return res;
}
