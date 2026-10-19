import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

type TokenPayload = {
  final_data?: {
    email?: string;
    role?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const cookieToken = (await cookies()).get("token")?.value;
  const token = bearer || cookieToken;

  const apikey = process.env.API_KEY;
  if (!apikey) return NextResponse.json({ success: false, error: "API is not Valid" }, { status: 401 });
  if (!token) return NextResponse.json({ success: false, error: "UnAuth" }, { status: 403 });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as TokenPayload;


    return NextResponse.json({ success: true, message: decoded}, { status: 200 });
  } catch {
    return NextResponse.json({ success: false, error: "UnAuth" }, { status: 401 });
  }
}
