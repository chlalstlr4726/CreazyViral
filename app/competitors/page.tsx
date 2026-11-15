"use client";

import { ReferenceSection } from "@/components/ReferenceSection";

export default function CompetitorsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">경쟁사</h1>
      <p className="mb-6 mt-1.5 text-gray-500">정해 둔 경쟁사 계정의 영상을 레퍼런스로 분석해 모아 봅니다. 계정 구분 없이 공통으로 보여줘요.</p>
      <ReferenceSection />
    </div>
  );
}
