import { NextRequest, NextResponse } from "next/server";
import { Paiflow, PaiflowApiError, type DeploymentCapabilities } from "@paiflow/sdk";
import { decryptText, encryptText, rateLimit, Security } from "@/firewall";
import { supabaseServer } from "@/lib";
import walletNetworks from "@/config/json_conf/wallet_networks.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAIFLOW_ORIGIN = "https://beta.app.paiflow.xyz";
const DEPLOYMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEPLOYMENT_TOKEN = /^pfk_[A-Za-z0-9_-]+$/;
const MAX_FLOWS = 5;

type StoredFlow = {
  id: number | string;
  created_at: string;
  deployment_id: string | null;
  deployment_token?: string;
  name?: string | null;
};

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function getAuth(request: NextRequest) {
  return Security(request);
}

function decryptDeploymentId(value: string) {
  return decryptText(value, process.env.WALLET_BANK_KEY || "");
}

function validateCapabilities(capabilities: DeploymentCapabilities) {
  const inputAsset = capabilities.inputAsset;
  const usdc = walletNetworks.stellar_testnet.tokens.USDC.classicAsset;
  const isUsdc = (inputAsset?.kind === "known" && inputAsset.symbol === "USDC") ||
    (inputAsset?.kind === "custom" && inputAsset.code === "USDC" && inputAsset.issuer === usdc.issuer);
  return capabilities.network === "testnet" && capabilities.triggerType === "deposit" &&
    capabilities.operations.execute.status === "supported" && isUsdc;
}

async function getOwnerFlows(email: string) {
  const { data, error } = await supabaseServer
    .from("paiflow")
    .select("id, created_at, deployment_id, deployment_token, name")
    .eq("email", email)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load your saved Paiflow deployments.");
  return (data ?? []) as StoredFlow[];
}

export async function GET(request: NextRequest) {
  const auth = await getAuth(request);
  if (!auth || auth.error) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!("email" in auth) || typeof auth.email !== "string") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!("network" in auth) || auth.network !== "stellar_testnet") return fail("Paiflow flows are available on Stellar Testnet only.", 400);
  const rate = rateLimit(request, { windowMs: 60_000, max: 30, keyPrefix: "Stellar_paiflow_flows_read" });
  if (!rate.allowed) return fail("Too many requests. Please try again in a minute.", 429);

  try {
    const rows = await getOwnerFlows(auth.email);
    const savedRows = rows.filter((row): row is StoredFlow & { deployment_id: string } =>
      typeof row.deployment_id === "string" && row.deployment_id.trim().length > 0
    );
    if (savedRows.length === 0) {
      return NextResponse.json({ success: true, flows: [] });
    }
    const flows = savedRows.map((row) => ({
      id: String(row.id),
      createdAt: row.created_at,
      deploymentId: decryptDeploymentId(row.deployment_id),
      name: row.name?.trim() || "Paiflow split",
    }));
    return NextResponse.json({ success: true, flows });
  } catch (error) {
    console.error("Paiflow deployment list failed:", error instanceof Error ? error.message : "unknown error");
    return fail("Could not decrypt or load your saved Paiflow deployments. Check the wallet encryption keys.", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuth(request);
  if (!auth || auth.error) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!("email" in auth) || typeof auth.email !== "string") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!("network" in auth) || auth.network !== "stellar_testnet") return fail("Switch to Stellar Testnet to add a Paiflow deployment.", 400);
  const rate = rateLimit(request, { windowMs: 60_000, max: 5, keyPrefix: "Stellar_paiflow_flows_write" });
  if (!rate.allowed) return fail("Too many add attempts. Wait a minute and try again.", 429);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object") return fail("Invalid request body.");
    body = parsed as Record<string, unknown>;
  } catch {
    return fail("Invalid request body.");
  }
  const deploymentId = typeof body.deploymentId === "string" ? body.deploymentId.trim() : "";
  const deploymentToken = typeof body.deploymentToken === "string" ? body.deploymentToken.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";

  if (!DEPLOYMENT_ID.test(deploymentId)) return fail("Enter a valid Paiflow deployment ID.");
  if (!DEPLOYMENT_TOKEN.test(deploymentToken)) return fail("Enter the single-deployment Paiflow API token beginning with pfk_.");

  let currentFlows: StoredFlow[];
  try {
    currentFlows = await getOwnerFlows(auth.email);
  } catch {
    return fail("Could not check your saved Paiflow deployments.", 500);
  }
  if (currentFlows.length >= MAX_FLOWS) return fail("You can save up to 5 Paiflow deployments.", 400);
  try {
    if (currentFlows.some((flow) => typeof flow.deployment_id === "string" && flow.deployment_id.trim().length > 0 && decryptDeploymentId(flow.deployment_id) === deploymentId)) {
      return fail("This Paiflow deployment is already saved.", 409);
    }
  } catch {
    return fail("Could not verify your saved Paiflow deployments. Check the wallet encryption keys.", 500);
  }

  try {
    const deployment = new Paiflow({ baseUrl: PAIFLOW_ORIGIN, token: deploymentToken }).deployment(deploymentId);
    const { data: capabilities } = await deployment.capabilities.get();
    if (!validateCapabilities(capabilities)) {
      return fail("Add an active Stellar Testnet deposit flow configured for USDC with Execute support.");
    }

    const encryptedDeploymentId = encryptText(deploymentId, process.env.WALLET_BANK_KEY || "");
    const encryptedDeploymentToken = encryptText(deploymentToken, process.env.WALLET_BANK_KEY || "");
    const { data, error } = await supabaseServer
      .from("paiflow")
      .insert({ deployment_id: encryptedDeploymentId, deployment_token: encryptedDeploymentToken, email: auth.email, name: name || "Paiflow split" })
      .select("id, created_at, name")
      .single();
    if (error || !data) {
      console.error("Could not save Paiflow deployment:", error?.code ?? "no row returned");
      return fail("Could not securely save this Paiflow deployment. Check that the paiflow table is configured.", 500);
    }
    return NextResponse.json({
      success: true,
      flow: { id: String(data.id), createdAt: data.created_at, deploymentId, name: data.name },
    });
  } catch (error) {
    if (error instanceof PaiflowApiError) {
      console.error("Paiflow deployment validation failed:", error.status, error.code, error.metadata.requestId ?? "no request id");
      return fail(error.status === 401 || error.status === 403
        ? "Paiflow rejected this token or it does not have access to the deployment."
        : error.status >= 500 ? "Paiflow could not validate the deployment right now." : error.message,
      error.status >= 500 ? 502 : 400);
    }
    console.error("Could not add Paiflow deployment:", error instanceof Error ? error.message : "unknown error");
    return fail("Could not validate or encrypt this Paiflow deployment. Check server encryption keys.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuth(request);
  if (!auth || auth.error) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!("email" in auth) || typeof auth.email !== "string") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!("network" in auth) || auth.network !== "stellar_testnet") return fail("Switch to Stellar Testnet to manage Paiflow deployments.", 400);
  const rate = rateLimit(request, { windowMs: 60_000, max: 10, keyPrefix: "Stellar_paiflow_flows_remove" });
  if (!rate.allowed) return fail("Too many requests. Please try again in a minute.", 429);

  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.");
  }
  const id = typeof body.id === "string" || typeof body.id === "number" ? String(body.id) : "";
  if (!/^\d+$/.test(id)) return fail("Choose a saved Paiflow deployment to remove.");

  const { data, error } = await supabaseServer
    .from("paiflow")
    .delete()
    .eq("id", id)
    .eq("email", auth.email)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Could not remove saved Paiflow deployment:", error.code);
    return fail("Could not remove this Paiflow deployment.", 500);
  }
  if (!data) return fail("Paiflow deployment not found.", 404);
  return NextResponse.json({ success: true });
}
