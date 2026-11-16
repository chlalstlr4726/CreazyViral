import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ACCOUNT_PROFILES } from "@/lib/accounts";
import { CALLBACK, exchangeInstagramCode, instagramOAuthConfig, STATE_COOKIE } from "@/lib/instagramOAuth";
import { sb } from "@/lib/sb";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const config = instagramOAuthConfig();
  if (!config) return NextResponse.json({ error: "instagram_not_configured" }, { status: 503 });

  const finish = (status: string) => {
    const url = new URL("/accounts", config.origin);
    url.searchParams.set("instagram", status);
    const response = NextResponse.redirect(url);
    response.cookies.set(STATE_COOKIE, "", {
      path: CALLBACK, maxAge: 0, httpOnly: true, secure: config.secure, sameSite: "lax",
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };

  const [expected, accountId] = (req.cookies.get(STATE_COOKIE)?.value ?? "").split(".");
  const account = ACCOUNT_PROFILES.find(({ id }) => id === accountId);
  const state = Buffer.from(req.nextUrl.searchParams.get("state") ?? "");
  if (!account || !expected || state.length !== Buffer.byteLength(expected) ||
      !timingSafeEqual(state, Buffer.from(expected))) return finish("invalid");
  if (req.nextUrl.searchParams.has("error")) return finish("cancelled");
  const code = req.nextUrl.searchParams.get("code");
  if (!code || code.length > 4096) return finish("invalid");

  try {
    const { token, identity, expiresAt } = await exchangeInstagramCode(code, config);
    if (identity.username?.toLowerCase() !== account.handle.toLowerCase()) return finish("account_mismatch");
    await sb("ig_tokens", {
      method: "POST", params: { on_conflict: "handle" },
      prefer: "resolution=merge-duplicates,return=minimal",
      body: { handle: account.handle, token, expires_at: expiresAt, updated_at: new Date().toISOString() },
    });
    await sb("ig_accounts", {
      method: "PATCH", params: { handle: `eq.${account.handle}` }, prefer: "return=minimal",
      body: {
        status: "connected", token_expires_at: expiresAt, ig_user_id: identity.user_id ?? identity.id ?? null,
        followers: identity.followers_count ?? null,
      },
    }).catch(() => {});
    return finish("connected");
  } catch (error) {
    return finish(error instanceof Error && error.message === "missing_permissions" ? "permissions" : "failed");
  }
}
