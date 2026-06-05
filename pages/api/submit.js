// /api/submit — 저장 시 호출. 앵커 채점 + 루브릭(LLM) 채점 + PDF + 드라이브 업로드.
import { scoreAnchors } from "../../lib/scoring.server.js";
import { scoreRubrics } from "../../lib/rubrics.server.js";
import { buildResultPdf } from "../../lib/pdf.server.js";
import { uploadToDrive } from "../../lib/drive.server.js";

export const config = {
  maxDuration: 60, // Vercel 함수 최대 실행 시간(초). LLM 10회 병렬 대비.
};

function sanitizeName(s) {
  return String(s || "").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40).trim() || "unknown";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 허용" });
  }

  const { name, studentId, answers } = req.body || {};
  if (!name || !studentId) {
    return res.status(400).json({ error: "이름과 학번을 입력해야 한다." });
  }
  if (!answers || typeof answers !== "object") {
    return res.status(400).json({ error: "답안이 없다." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  try {
    // 1) 앵커 자동 채점 (즉시)
    const anchor = scoreAnchors(answers);

    // 2) 루브릭 LLM 채점 (병렬). 키 없으면 0점 처리하고 진행.
    let rubric;
    if (apiKey) {
      rubric = await scoreRubrics(answers, { model, apiKey });
    } else {
      const { RUBRICS } = await import("../../lib/rubrics.server.js");
      const perItem = {};
      Object.keys(RUBRICS).forEach(
        (id) => (perItem[id] = { score: 0, max: RUBRICS[id].max, reason: "채점 키 미설정" })
      );
      const max = Object.values(perItem).reduce((a, v) => a + v.max, 0);
      rubric = { perItem, total: 0, max };
    }

    const total = anchor.total + rubric.total;
    const max = anchor.max + rubric.max;
    const submittedAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    const payload = { name, studentId, submittedAt, anchor, rubric, total, max };

    // 3) PDF 생성 + 드라이브 업로드 (실패해도 점수는 반환)
    let drive = null;
    let driveError = null;
    try {
      const pdf = await buildResultPdf(payload);
      const filename = `${sanitizeName(name)}_${sanitizeName(studentId)}_${Date.now()}.pdf`;
      drive = await uploadToDrive(pdf, filename);
    } catch (e) {
      driveError = String(e.message || e);
      console.error("Drive/PDF 실패:", driveError);
    }

    return res.status(200).json({
      ok: true,
      total,
      max,
      anchor: { total: anchor.total, max: anchor.max },
      rubric: { total: rubric.total, max: rubric.max },
      perItem: buildClientBreakdown(anchor, rubric),
      saved: !!drive,
      driveError,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "채점 중 오류", detail: String(e.message || e) });
  }
}

// 학생 화면에 보여줄 문항별 요약(정답키는 노출하지 않음)
function buildClientBreakdown(anchor, rubric) {
  const out = {};
  const ids = Object.keys(anchor.perItem);
  ids.forEach((id) => {
    const a = anchor.perItem[id];
    const r = rubric.perItem[id] || { score: 0, max: 0, reason: "" };
    out[id] = {
      score: a.score + r.score,
      max: a.max + r.max,
      reason: r.reason || "",
    };
  });
  return out;
}
