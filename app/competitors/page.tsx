"use client";

import { ReferenceSection } from "@/components/ReferenceSection";

export default function CompetitorsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">경쟁사</h1>
      <p className="mb-6 mt-1.5 text-gray-500">경쟁사와 비슷한 분야에서 최근 터진 영상을 모아 봅니다. 계정 구분 없이 공통으로 보여줘요.</p>
      <ReferenceSection />
    </div>
  );
}
