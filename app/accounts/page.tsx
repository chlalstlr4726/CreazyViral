"use client";

import { Info, Plus } from "lucide-react";
import { ACCOUNTS } from "@/lib/mock";
import { compact } from "@/lib/format";
import { Button, Chip, Panel } from "@/components/ui";

export default function AccountsPage() {
  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">계정 연결</h1>
          <p className="mt-1.5 text-gray-500">성과를 불러올 인스타그램 계정을 관리해요. 현재 {ACCOUNTS.length}개 계정이 등록돼 있어요.</p>
        </div>
        <Button disabled title="Instagram 공식 API(Meta 앱) 준비 후 활성화">
          <Plus size={16} /> 계정 추가
        </Button>
      </div>

      <div className="mt-6 flex gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm leading-relaxed text-blue-900/80">
        <Info size={16} className="mt-0.5 shrink-0 text-blue-500" />
        <p>
          실제 연결은 Instagram 공식 API를 쓰며, 비즈니스(또는 크리에이터) 계정이 페이스북 페이지와 연결되어 있어야 해요. Meta 앱 설정이 끝나면 이 화면의 [연결] 버튼이 활성화돼요. 그 전에는 샘플 데이터로
          화면을 확인할 수 있어요.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        {ACCOUNTS.map((a) => (
          <Panel key={a.id} className="flex items-center gap-4 p-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold text-white" style={{ background: a.color }}>
              {a.handle[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">@{a.handle}</div>
              <div className="text-sm text-gray-500">
                {a.name}, 팔로워 {compact(a.followers)}
              </div>
            </div>
            {a.status === "connected" ? <Chip tone="green">연결됨</Chip> : <Chip tone="red">재연결 필요</Chip>}
            <Button variant="secondary" size="sm" disabled>
              {a.status === "connected" ? "해제" : "재연결"}
            </Button>
          </Panel>
        ))}
      </div>
    </div>
  );
}
