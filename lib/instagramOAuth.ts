import { sbConfigured } from "./sb";
import { instagramIdentity } from "./instagram";

export const STATE_COOKIE = "creazy_ig_oauth";
export const SCOPES = ["instagram_business_basic", "instagram_business_manage_insights"];
export const CALLBACK = "/api/instagram/callback";

export function instagramOAuthConfig() {
  const appId = process.env.INSTAGRAM_APP_ID?.trim();
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  const origin = process.env.INSTAGRAM_APP_ORIGIN?.trim();
  if (!appId || !appSecret || !origin || !sbConfigured()) return null;
  try {
    const url = new URL(origin);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.origin !== origin || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) return null;
    return { appId, appSecret, origin, secure: url.protocol === "https:", redirectUri: origin + CALLBACK };
  } catch {
    return null;
  }
}

export async function exchangeInstagramCode(code: string, config: NonNullable<ReturnType<typeof instagramOAuthConfig>>) {
  const short = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: config.appId, client_secret: config.appSecret, grant_type: "authorization_code",
      redirect_uri: config.redirectUri, code,
    }),
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000),
  });
  if (!short.ok) throw new Error("short_token_exchange");
  const result = await short.json();
  const access = result.data?.[0] ?? result;
  if (typeof access.access_token !== "string" || !access.access_token) throw new Error("invalid_short_token");
  const granted = access.permissions;
  if (granted != null) {
    const list = typeof granted === "string" ? granted.split(",").map((value) => value.trim()) : granted;
    if (!Array.isArray(list) || !SCOPES.every((scope) => list.includes(scope))) throw new Error("missing_permissions");
  }

  const exchange = new URL("https://graph.instagram.com/access_token");
  exchange.search = new URLSearchParams({
    grant_type: "ig_exchange_token", client_secret: config.appSecret, access_token: access.access_token,
  }).toString();
  const long = await fetch(exchange, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000) });
  if (!long.ok) throw new Error("long_token_exchange");
  const { access_token: token, expires_in: seconds } = await long.json();
  if (typeof token !== "string" || !token || !Number.isFinite(seconds) || seconds <= 0) throw new Error("invalid_long_token");
  const identity = await instagramIdentity(token);
  return { token, identity, expiresAt: new Date(Date.now() + seconds * 1000).toISOString() };
}
