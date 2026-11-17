"use client";

/** 사진 띠의 한 장(도하가 고른 밈 사진 묶음). 끝없이 흐르도록 두 번 이어 붙인다. */
const STRIP = "/seed/strip.jpg";

const PERSONAS = [
  { who: "a", tag: "방구석 백수", title: "인스타 릴스 중독자", img: "/seed/meme-addict.jpg", alt: "릴스 5시간 둠스크롤 뒤 뇌가 빨려 나간 사람 그림(밈)", pts: ["아무 도움 안 되는 릴스만 내리며 감각을 깎아 먹음", "도파민에 절여짐", "인스타에 지배당함"] },
  { who: "b", tag: "나도 이젠… 감다살?", title: "릴스 개척자", img: "/seed/meme-pioneer.jpg", alt: "이 페이지에서 5분 뒤 눈부시게 깨달은 사람 그림(밈)", pts: ["엄선된 릴스만 쏙쏙(오늘의 100편)", "릴스마다 넓혀 볼 아이디어 씨앗까지", "아이디어는 내가 스스로 키움"] },
] as const;

/** 첫 화면(도하의 피그마 디자인): 흐르는 사진 띠, 세 문장, 릴스 중독자 대 릴스 개척자 카드. */
export function SeedHero() {
  return (
    <section className="seed-hero" aria-label="씨앗 탭 소개">
      <div className="seed-strip" aria-hidden="true">
        <div className="seed-strip-track">
          <img src={STRIP} alt="" />
          <img src={STRIP} alt="" />
        </div>
      </div>
      <div className="seed-motto">
        <p>내 감과 판단력은 AI에게 맡기지 않는다.</p>
        <p>AI는 아이디어를 주지 않는다. 아이디어 씨앗만 건넨다.</p>
        <p>사고력을 서서히 잃어감을 경계하자.</p>
      </div>
      <div className="seed-personas">
        {PERSONAS.map((p) => (
          <article key={p.who} className={"seed-persona " + p.who}>
            <span className="seed-ptag">{p.tag}</span>
            <h3>{p.title}</h3>
            <img src={p.img} alt={p.alt} />
            <ul>{p.pts.map((t) => <li key={t}>{t}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
  );
}
