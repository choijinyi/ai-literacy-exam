// 서버 전용. 결과 PDF와 점수 메타데이터를 Vercel Blob에 저장하고, 목록을 읽어온다.
import { put, list } from "@vercel/blob";

function safeName(s) {
  return String(s || "").replace(/[^\w가-힣]/g, "_").slice(0, 40) || "unknown";
}

export async function saveResult(payload, pdfBuffer) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN 미설정");

  const ts = Date.now();
  const base = `results/${ts}_${safeName(payload.name)}_${safeName(payload.studentId)}`;

  const pdfBlob = await put(`${base}.pdf`, pdfBuffer, {
    access: "public",
    contentType: "application/pdf",
    addRandomSuffix: true,
    token,
  });

  const meta = {
    ts,
    name: payload.name,
    studentId: payload.studentId,
    submittedAt: payload.submittedAt,
    total: payload.total,
    max: payload.max,
    anchor: payload.anchor ? payload.anchor.total : null,
    rubric: payload.rubric ? payload.rubric.total : null,
    pdfUrl: pdfBlob.url,
  };

  await put(`${base}.json`, JSON.stringify(meta), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: true,
    token,
  });

  return meta;
}

export async function listResults() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN 미설정");

  const metas = [];
  let cursor;
  do {
    const res = await list({ prefix: "results/", cursor, limit: 1000, token });
    const jsons = res.blobs.filter((b) => b.pathname.endsWith(".json"));
    await Promise.all(
      jsons.map(async (b) => {
        try {
          const r = await fetch(b.url);
          if (r.ok) metas.push(await r.json());
        } catch (_) {}
      })
    );
    cursor = res.cursor;
  } while (cursor);

  metas.sort((a, b) => b.ts - a.ts);
  return metas;
}
