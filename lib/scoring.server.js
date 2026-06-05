// 서버 전용. 절대 클라이언트에서 import 하지 말 것.
// 앵커(자동·결정론적) 채점. 합계 51점.

const digitsOf = (s) => (String(s || "").match(/\d+/g) || []).join("");
const onlyDigits = (s) => String(s || "").replace(/[^\d]/g, "");

// 5번 표에 등장하는 정답 수치(숫자만 추출한 형태)
const Q5_VALID = new Set([
  "3200", "3850", "4100", "4600",
  "410", "520", "480", "610",
  "38", "44", "47", "52",
]);

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function scoreAnchors(a = {}) {
  const r = {}; // 문항별 {score, max, detail}

  // Q1 (6): 3차에 걸쳐 서로 다른 개선 차원 수
  {
    const dims = (a.q1?.dims || []).filter(Boolean);
    const distinct = new Set(dims).size;
    let s = 0;
    if (distinct >= 3) s = 6;
    else if (distinct === 2) s = 3;
    else s = 0;
    r.q1 = { score: s, max: 6, detail: `서로 다른 개선 차원 ${distinct}종` };
  }

  // Q2 (8): 오류 식별. 정답 {2,5,7,9}, 사실 {1,3,4,6,8}
  {
    const correct = new Set([2, 5, 7, 9]);
    const facts = new Set([1, 3, 4, 6, 8]);
    const picked = (a.q2?.errors || []).map(Number);
    let hit = 0, fp = 0;
    picked.forEach((n) => {
      if (correct.has(n)) hit += 1;
      else if (facts.has(n)) fp += 1;
    });
    const s = clamp(hit * 2 - fp * 1, 0, 8);
    r.q2 = { score: s, max: 8, detail: `정답 ${hit}/4, 오지목 ${fp}` };
  }

  // Q3 (5): B=1위(2.5), C=3위(2.5)
  {
    const ranks = a.q3?.ranks || {}; // {A,B,C} = 1|2|3
    let s = 0;
    if (Number(ranks.B) === 1) s += 2.5;
    if (Number(ranks.C) === 3) s += 2.5;
    r.q3 = { score: s, max: 5, detail: `B순위 ${ranks.B ?? "-"}, C순위 ${ranks.C ?? "-"}` };
  }

  // Q4 (4): 산출물 3종(2) + 사람 검증 지점 언급(2) — 키워드 기반(관대)
  {
    const t = String(a.q4?.workflow || "");
    const hasSummary = /요약|1쪽|한 ?쪽|한장|한 ?장/.test(t);
    const hasSlide = /슬라이드|ppt|피피티|발표/i.test(t);
    const hasNotice = /공지|안내문|공지문|전 ?직원/.test(t);
    const deliverHits = [hasSummary, hasSlide, hasNotice].filter(Boolean).length;
    const deliverScore = deliverHits >= 3 ? 2 : deliverHits === 2 ? 1 : 0;
    const hasVerify = /검증|검토|확인|사람이|수작업|수동|fact|팩트|교차/i.test(t);
    const s = deliverScore + (hasVerify ? 2 : 0);
    r.q4 = { score: s, max: 4, detail: `산출물 ${deliverHits}/3, 검증언급 ${hasVerify ? "O" : "X"}` };
  }

  // Q5 (6): 250자 이내(2) + 인용 수치 2개 표 일치(각 2)
  {
    const promo = String(a.q5?.promo || "");
    const len = [...promo].length;
    const lenScore = len > 0 && len <= 250 ? 2 : 0;
    const figs = a.q5?.figures || [];
    let figScore = 0;
    [0, 1].forEach((i) => {
      const d = onlyDigits(figs[i]);
      if (d && Q5_VALID.has(d)) figScore += 2;
    });
    const s = lenScore + figScore;
    r.q5 = { score: s, max: 6, detail: `글자수 ${len}, 인용일치 ${figScore / 2}/2` };
  }

  // Q6 (3): 템플릿에 치환 변수 표기 존재
  {
    const tpl = String(a.q6?.template || "");
    const hasVar = /\[[^\]]+\]|\{[^}]+\}|<[^>]+>|【[^】]+】/.test(tpl);
    const s = hasVar ? 3 : 0;
    r.q6 = { score: s, max: 3, detail: hasVar ? "변수 표기 O" : "변수 표기 X" };
  }

  // Q7 (5): (가) 문서LLM 1.5, (나) 검색 2, (다) 이미지 1.5
  {
    const sel = a.q7?.tools || {};
    let s = 0;
    const okGa = sel.ga === "문서 업로드형 LLM(긴 맥락 분석)";
    const okGb = sel.gb === "실시간 검색연동";
    const okGc = sel.gc === "이미지 생성";
    if (okGa) s += 1.5;
    if (okGb) s += 2;
    if (okGc) s += 1.5;
    r.q7 = { score: s, max: 5, detail: `가 ${okGa ? "✓" : "✗"} / 나 ${okGb ? "✓" : "✗"} / 다 ${okGc ? "✓" : "✗"}` };
  }

  // Q8 (7): S1,S2,S4=있음 / S3,S5,S6=없음
  {
    const key = { s1: "has", s2: "has", s3: "none", s4: "has", s5: "none", s6: "none" };
    const ans = a.q8?.claims || {};
    let correct = 0;
    Object.keys(key).forEach((k) => {
      if (ans[k] === key[k]) correct += 1;
    });
    const s = Math.round((correct / 6) * 7);
    r.q8 = { score: s, max: 7, detail: `분류 정답 ${correct}/6` };
  }

  // Q9 (4): 핵심 위험 2개 이상(4) / 1개(2). 함정 선택 시 -1
  {
    const picked = a.q9?.risks || [];
    const real = new Set([
      "개인정보 외부 유출",
      "정보주체 동의 없는 제3자 제공",
      "입력 데이터가 모델 재학습에 쓰일 가능성",
      "데이터 국외 이전 위험",
    ]);
    const trap = "홍보 문구가 너무 길어지는 문제";
    const realHits = picked.filter((p) => real.has(p)).length;
    const trapHit = picked.includes(trap) ? 1 : 0;
    let s = realHits >= 2 ? 4 : realHits === 1 ? 2 : 0;
    s = clamp(s - trapHit, 0, 4);
    r.q9 = { score: s, max: 4, detail: `핵심위험 ${realHits}, 함정 ${trapHit ? "선택" : "회피"}` };
  }

  // Q10 (3): 진단이 '구체성/맥락 부재' 계열 키워드 포함
  {
    const dx = String(a.q10?.diagnosis || "");
    const ok = /구체|맥락|대상|모호|막연|정보 ?부족|조건|불명확|범위/.test(dx);
    const s = ok ? 3 : 0;
    r.q10 = { score: s, max: 3, detail: ok ? "결함 유형 일치" : "결함 유형 불일치" };
  }

  const total = Object.values(r).reduce((acc, v) => acc + v.score, 0);
  const max = Object.values(r).reduce((acc, v) => acc + v.max, 0);
  return { perItem: r, total, max };
}
