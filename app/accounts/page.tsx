import { Link2 } from "lucide-react";
import { ACCOUNT_PROFILES } from "@/lib/accounts";
import { compact } from "@/lib/format";
import { instagramOAuthConfig } from "@/lib/instagramOAuth";
import { sb, sbConfigured } from "@/lib/sb";
import { Chip, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  connected: "Instagram 계정을 연결했어요. 다음 성과 수집부터 반영돼요.",
  cancelled: "Instagram 연결을 취소했어요.",
  account_mismatch: "선택한 계정과 로그인한 계정이 달라요. 연결할 계정으로 다시 로그인해 주세요.",
  invalid: "연결 요청이 만료됐거나 유효하지 않아요. 버튼을 다시 눌러 주세요.",
  permissions: "기본 정보와 성과 조회 권한을 모두 허용해 주세요.",
  failed: "Instagram 연결을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.",
};

type AccountRow = { handle: string; followers: number | null; status: string; token_expires_at: string | null };
type TokenRow = { handle: string; expires_at: string | null };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ instagram?: string }> }) {
  const result = (await searchParams).instagram;
  const config = instagramOAuthConfig();
  const [accounts, tokens] = await Promise.all([
    sbConfigured() ? sb<AccountRow[]>("ig_accounts", { params: { select: "handle,followers,status,token_expires_at" } }).catch(() => []) : [],
    config ? sb<TokenRow[]>("ig_tokens", { params: { select: "handle,expires_at" } }).catch(() => null) : null,
  ]);
  const message = result && Object.hasOwn(messages, result) ? messages[result] : undefined;

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">계정 연결</h1>
      <p className="mt-1.5 text-gray-500">Instagram 비즈니스 또는 크리에이터 계정을 연결하면 릴스 성과를 가져와요.</p>
      {message && <p role="status" className="mt-5 rounded-lg bg-blue-50 p-4 text-sm text-blue-900">{message}</p>}
      {!config && <p className="mt-5 text-sm text-gray-500">Instagram 연결을 위한 서버 설정이 필요해요.</p>}
      {config && tokens === null && <p role="alert" className="mt-5 text-sm text-gray-500">연결 저장소를 확인한 뒤 다시 시도해 주세요.</p>}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {ACCOUNT_PROFILES.map((account) => {
          const row = accounts.find(({ handle }) => handle === account.handle);
          const token = tokens?.find(({ handle }) => handle === account.handle);
          const expired = !!token?.expires_at && Date.parse(token.expires_at) <= Date.now();
          const revoked = row?.status === "expired" && row.token_expires_at === token?.expires_at;
          const connected = !expired && !revoked && (!!token || row?.status === "connected");
          const label = connected ? "Instagram 다시 연결" : "Instagram으로 연결";
          return (
            <Panel key={account.id} className="flex flex-wrap items-center gap-4 p-5">
              <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold text-white" style={{ background: account.color }}>{account.handle[0].toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">@{account.handle}</div>
                <div className="text-sm text-gray-500">{account.name}{row?.followers != null && `, 팔로워 ${compact(row.followers)}`}</div>
              </div>
              <Chip tone={connected ? "green" : "gray"}>{connected ? "연결됨" : expired || revoked ? "재연결 필요" : "연결 대기"}</Chip>
              {config && tokens !== null ? (
                <a href={`${config.origin}/api/instagram/connect?account=${account.id}`} className="press inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-gray-50"><Link2 size={16} />{label}</a>
              ) : (
                <button type="button" disabled className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500"><Link2 size={16} />{label}</button>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
