import { NextRequest, NextResponse } from "next/server";
import { Security, rateLimit } from "@/firewall";
import { supabaseServer } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FRIENDS = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FriendProfile = {
  email: string;
  username: string;
  walletAddress: string | null;
  walletNetwork: string | null;
  available: boolean;
};

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function cleanFriendEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((email): email is string => typeof email === "string")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => EMAIL_PATTERN.test(email)))].slice(0, MAX_FRIENDS);
}

async function getFriendProfiles(emails: string[]): Promise<FriendProfile[]> {
  if (emails.length === 0) return [];

  const [accountsResult, walletsResult] = await Promise.all([
    supabaseServer.from("tbl_auth").select("email, username, confirm_email, status").in("email", emails),
    supabaseServer.from("tbl_wallet").select("email, wallet_address, network").in("email", emails),
  ]);
  if (accountsResult.error || walletsResult.error) throw new Error("Could not load friend accounts.");

  const accounts = new Map((accountsResult.data ?? []).map((account) => [
    String(account.email).toLowerCase(),
    account,
  ]));
  const wallets = new Map((walletsResult.data ?? []).map((wallet) => [
    String(wallet.email).toLowerCase(),
    wallet,
  ]));

  return emails.map((email) => {
    const account = accounts.get(email);
    const isConfirmed = Number(account?.confirm_email) === 1;
    const wallet = isConfirmed ? wallets.get(email) : undefined;
    return {
      email,
      username: isConfirmed && typeof account?.username === "string" ? account.username : "Otterpie account unavailable",
      walletAddress: typeof wallet?.wallet_address === "string" ? wallet.wallet_address : null,
      walletNetwork: wallet?.network === "stellar"
        ? (Number(account?.status) === 0 ? "stellar_testnet" : "stellar")
        : typeof wallet?.network === "string" ? wallet.network : null,
      available: isConfirmed,
    };
  });
}

async function findConfirmedFriend(email: string): Promise<FriendProfile | null> {
  const { data: account, error } = await supabaseServer
    .from("tbl_auth")
    .select("email, username, confirm_email, status")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error("Could not search Otterpie accounts.");
  if (!account || Number(account.confirm_email) !== 1) return null;

  const { data: wallet, error: walletError } = await supabaseServer
    .from("tbl_wallet")
    .select("wallet_address, network")
    .eq("email", email)
    .maybeSingle();
  if (walletError) throw new Error("Could not load the friend wallet.");

  return {
    email: String(account.email).toLowerCase(),
    username: typeof account.username === "string" ? account.username : "Otterpie friend",
    walletAddress: typeof wallet?.wallet_address === "string" ? wallet.wallet_address : null,
    walletNetwork: wallet?.network === "stellar"
      ? (Number(account.status) === 0 ? "stellar_testnet" : "stellar")
      : typeof wallet?.network === "string" ? wallet.network : null,
    available: true,
  };
}

async function getOwnerFriends(ownerEmail: string): Promise<string[]> {
  const { data, error } = await supabaseServer
    .from("tbl_auth")
    .select("friends")
    .eq("email", ownerEmail)
    .maybeSingle();
  if (error) throw new Error("Could not load your Otter friends.");
  if (!data) throw new Error("Otterpie account not found.");
  return cleanFriendEmails(data.friends);
}

export async function GET(request: NextRequest) {
  const auth = await Security(request);
  if (!auth || auth.error || !("email" in auth) || typeof auth.email !== "string") return jsonError("Unauthorized", 401);
  const rate = rateLimit(request, { windowMs: 60_000, max: 30, keyPrefix: "Otter_friends_read" });
  if (!rate.allowed) return jsonError("Too many friend requests. Please try again in a minute.", 429);

  try {
    const ownerEmail = auth.email.toLowerCase();
    const emails = (await getOwnerFriends(auth.email)).filter((email) => email !== ownerEmail);
    const friends = await getFriendProfiles(emails);
    return NextResponse.json({ success: true, friends });
  } catch (error) {
    console.error("Friend list lookup failed:", error);
    return jsonError(error instanceof Error ? error.message : "Could not load your friends.", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await Security(request);
  if (!auth || auth.error || !("email" in auth) || typeof auth.email !== "string") return jsonError("Unauthorized", 401);
  const rate = rateLimit(request, { windowMs: 60_000, max: 20, keyPrefix: "Otter_friends_write" });
  if (!rate.allowed) return jsonError("Too many friend requests. Please try again in a minute.", 429);

  let body: { action?: unknown; email?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.");
  }
  if (body.action !== "add" && body.action !== "remove") return jsonError("Choose whether to add or remove a friend.");
  if (typeof body.email !== "string") return jsonError("Enter your friend's Otterpie email.");

  const friendEmail = body.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(friendEmail)) return jsonError("Enter a valid email address.");
  if (friendEmail === auth.email.toLowerCase()) return jsonError("You cannot add yourself as a friend.");

  try {
    const friends = await getOwnerFriends(auth.email);

    if (body.action === "add") {
      if (friends.includes(friendEmail)) return jsonError("This Otterpie account is already your friend.", 409);
      if (friends.length >= MAX_FRIENDS) return jsonError("You have reached the friend list limit.", 400);
      const profile = await findConfirmedFriend(friendEmail);
      if (!profile) return jsonError("No confirmed Otterpie account was found for that email.", 404);

      const nextFriends = [...friends, friendEmail];
      const { error } = await supabaseServer
        .from("tbl_auth")
        .update({ friends: nextFriends })
        .eq("email", auth.email);
      if (error) {
        console.error("Could not add Otter friend:", error.code);
        return jsonError("Could not save this friend.", 500);
      }
      return NextResponse.json({ success: true, friend: profile, friends: nextFriends });
    }

    if (!friends.includes(friendEmail)) return jsonError("This account is not in your friends list.", 404);
    const nextFriends = friends.filter((email) => email !== friendEmail);
    const { error } = await supabaseServer
      .from("tbl_auth")
      .update({ friends: nextFriends })
      .eq("email", auth.email);
    if (error) {
      console.error("Could not remove Otter friend:", error.code);
      return jsonError("Could not remove this friend.", 500);
    }
    return NextResponse.json({ success: true, friends: nextFriends });
  } catch (error) {
    console.error("Otter friend update failed:", error);
    return jsonError(error instanceof Error ? error.message : "Could not update your friends.", 500);
  }
}
