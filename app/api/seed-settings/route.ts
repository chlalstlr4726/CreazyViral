import { NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { sanitize } from "@/components/seed/settings";

// 씨앗 탭 편집 모드의 '저장': 개발 화면(내 컴퓨터)에서만 components/seed/seedSettings.json을 고쳐 쓴다. 배포된 화면에서는 막는다.
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({ ok: false, error: "dev_only" }, { status: 403 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const file = path.join(process.cwd(), "components", "seed", "seedSettings.json");
  await writeFile(file, JSON.stringify(sanitize(body), null, 2) + "\n", "utf8");
  return NextResponse.json({ ok: true });
}
