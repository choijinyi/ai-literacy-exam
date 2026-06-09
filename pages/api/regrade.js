// 교수 전용. 저장된 답안으로 한 건을 다시 채점하고 결과를 교체한다.
import { scoreAnchors } from "../../lib/scoring.server.js";
import { scoreRubrics } from "../../lib/rubrics.server.js";
import { buildResultPdf } from "../../lib/pdf.server.js";
import { saveResult, listResults, deleteBlobs } from "../../lib/store.server.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const pw = req.headers["x-admin-key"] || (req.query && req.query.key) || "";
  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
  }

  const ts = Number(req.query.ts);
  if (!ts) return res.status(400).json({ error: "ts가 필요합니다." });

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY 미설정" });

  try {
    const all = await listResults({ withAnswers: true });
    const target = all.find((m) => m.ts === ts);
    if (!target) return res.status(404).json({ error: "해당 제출을 찾을 수 없습니다." });
    if (!target.answers) {
      return res.status(422).json({
        error: "이 제출은 답안이 저장되어 있지 않아 재채점할 수 없습니다(구버전 제출).",
        noAnswers: true,
      });
    }

    const answers = target.answers;
    const anchor = scoreAnchors(answers);
    const rubric = await scoreRubrics(answers, { model, apiKey });
    if (rubric.failed) {
      return res.status(429).json({ error: "재채점 호출이 또 실패했습니다(한도/크레딧 확인). 잠시 후 다시 시도하세요." });
    }

    const total = anchor.total + rubric.total;
    const max = anchor.max + rubric.max;
    const payload = {
      ts: target.ts,
      name: target.name,
      studentId: target.studentId,
      submittedAt: target.submittedAt,
      anchor,
      rubric,
      total,
      max,
    };

    const pdf = await buildResultPdf(payload);
    await saveResult(payload, pdf, { answers, status: "done" });
    await deleteBlobs([target.pdfUrl, target._jsonUrl]);

    return res.status(200).json({
      ok: true,
      name: target.name,
      studentId: target.studentId,
      total,
      max,
      rubric: rubric.total,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
