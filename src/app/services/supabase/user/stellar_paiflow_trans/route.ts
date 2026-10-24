import { NextRequest, NextResponse } from "next/server";
import { Security } from "@/firewall";
import { supabaseServer } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEPLOYMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseDeploymentId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (DEPLOYMENT_ID.test(input)) return input.toLowerCase();
  try {
    const url = new URL(input);
    if (url.origin !== "https://beta.app.paiflow.xyz") return null;
    const match = url.pathname.match(/^\/(?:deployments|trigger)\/([0-9a-f-]+)\/?$/i);
    return match && DEPLOYMENT_ID.test(match[1]) ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = await Security(request);
  const email = auth && !auth.error && "email" in auth && typeof auth.email === "string" ? auth.email : "";
  if (!email) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseServer
    .from("tbl_auth")
    .select("paiflow_address")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("Could not load linked Paiflow:", error);
    return NextResponse.json({ success: false, error: "Could not load your linked Paiflow." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });

  return NextResponse.json({ success: true, address: data.paiflow_address ?? null });
}

export async function POST(request: NextRequest) {
  const auth = await Security(request);
  const email = auth && !auth.error && "email" in auth && typeof auth.email === "string" ? auth.email : "";
  if (!email) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let body: { action?: unknown; address?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }

  if (body.action !== "link" && body.action !== "unlink") {
    return NextResponse.json({ success: false, error: "Choose whether to link or unlink a Paiflow." }, { status: 400 });
  }

  if (body.action === "link") {
    if (!("network" in auth) || auth.network !== "stellar_testnet") {
      return NextResponse.json({ success: false, error: "Switch to Stellar Testnet before linking a Paiflow contract." }, { status: 400 });
    }
    const deploymentId = parseDeploymentId(body.address);
    if (!deploymentId) return NextResponse.json({ success: false, error: "Enter a Paiflow deployment ID or its beta.app.paiflow.xyz deployment link." }, { status: 400 });

    const { data, error } = await supabaseServer
      .from("tbl_auth")
      .update({ paiflow_address: deploymentId })
      .eq("email", email)
      .select("paiflow_address")
      .maybeSingle();

    if (error) {
      console.error("Could not link Paiflow:", error);
      return NextResponse.json({ success: false, error: "Could not save the Paiflow contract address." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
    return NextResponse.json({ success: true, address: data.paiflow_address, deploymentId: data.paiflow_address });
  }

  const { data, error } = await supabaseServer
    .from("tbl_auth")
    .update({ paiflow_address: null })
    .eq("email", email)
    .select("email")
    .maybeSingle();

  if (error) {
    console.error("Could not unlink Paiflow:", error);
    return NextResponse.json({ success: false, error: "Could not unlink the Paiflow contract." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
  return NextResponse.json({ success: true, address: null });
}
