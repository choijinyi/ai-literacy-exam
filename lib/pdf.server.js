// 서버 전용. 결과 PDF 생성. 한글 폰트는 런타임에 CDN에서 TTF로 로드.
import PDFDocument from "pdfkit";
import { QUESTIONS } from "./questions.public.js";

let cachedFont = null;
async function getKoreanFont() {
  if (cachedFont) return cachedFont;
  const url =
    process.env.KR_FONT_URL ||
    "https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-sans-kr/NotoSansKR_400Regular.ttf";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`폰트 로드 실패: ${res.status}`);
  const ab = await res.arrayBuffer();
  cachedFont = Buffer.from(ab);
  return cachedFont;
}

const titleOf = (id) => QUESTIONS.find((q) => q.id === id)?.title || id;

export async function buildResultPdf(payload) {
  const { name, studentId, submittedAt, anchor, rubric, total, max } = payload;
  const font = await getKoreanFont();

  return await new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      doc.registerFont("KR", font);
      doc.font("KR");

      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // 머리말
      doc.fontSize(18).text("AI 활용 능력 시험 결과", { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor("#666")
        .text("일반 AI 리터러시 · 10문항 100점", { align: "center" });
      doc.fillColor("#000").moveDown(1);

      doc.fontSize(11);
      doc.text(`응시자: ${name}`);
      doc.text(`학번: ${studentId}`);
      doc.text(`제출시각: ${submittedAt}`);
      doc.moveDown(0.5);

      doc.fontSize(22).fillColor("#1a4d8f")
        .text(`총점  ${total} / ${max}`, { align: "left" });
      doc.fillColor("#000").fontSize(9)
        .text(`(자동채점 ${anchor.total}/${anchor.max} + 루브릭 ${rubric.total}/${rubric.max})`);
      doc.moveDown(1);

      // 문항별 표
      doc.fontSize(13).text("문항별 점수", { underline: true });
      doc.moveDown(0.5);

      const ids = QUESTIONS.map((q) => q.id);
      ids.forEach((id) => {
        const a = anchor.perItem[id] || { score: 0, max: 0, detail: "" };
        const r = rubric.perItem[id] || { score: 0, max: 0, reason: "" };
        const itemTotal = a.score + r.score;
        const itemMax = a.max + r.max;

        doc.fontSize(11).fillColor("#000")
          .text(`${titleOf(id)}  —  ${itemTotal} / ${itemMax}점`);
        doc.fontSize(9).fillColor("#444")
          .text(`· 자동채점 ${a.score}/${a.max}  (${a.detail || "-"})`, { indent: 12 });
        doc.text(`· 루브릭 ${r.score}/${r.max}  ${r.reason || "-"}`, { indent: 12 });
        doc.moveDown(0.6);
      });

      doc.moveDown(1);
      doc.fontSize(8).fillColor("#999")
        .text(
          "루브릭 점수는 AI 채점기에 의한 것으로 ±1점의 편차가 있을 수 있다. 최종 점수는 출제자 검토 후 확정될 수 있다.",
          { align: "left" }
        );

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
