// 서버 전용. 결과 PDF·점수·답안·상태를 Vercel Blob에 저장하고, 목록/삭제를 제공한다.
import { put, list, del } from "@vercel/blob";

function safeName(s) {
  return String(s || "").replace(/[^\w가-힣]/g, "_").slice(0, 40) || "unknown";
}

// payload: 점수 묶음, opts: { answers, status }
export async function saveResult(payload, pdfBuffer, opts = {}) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN 미설정");

  const ts = payload.ts || Date.now();
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
    status: opts.status || "done", // "done" | "pending"
    pdfUrl: pdfBlob.url,
    answers: opts.answers || null, // 재채점을 위해 원답안 보관
  };

  const jsonBlob = await put(`${base}.json`, JSON.stringify(meta), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: true,
    token,
  });

  return { ...meta, _jsonUrl: jsonBlob.url };
}

// 목록 조회. withAnswers=false면 답안은 제외하고 반환(브라우저 전송용).
export async function listResults({ withAnswers = false } = {}) {
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
          if (r.ok) {
            const m = await r.json();
            m._jsonUrl = b.url;
            metas.push(m);
          }
        } catch (_) {}
      })
    );
    cursor = res.cursor;
  } while (cursor);

  metas.sort((a, b) => b.ts - a.ts);
  if (!withAnswers) metas.forEach((m) => delete m.answers);
  return metas;
}

export async function deleteBlobs(urls) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const targets = urls.filter(Boolean);
  if (targets.length) await del(targets, { token });
}
