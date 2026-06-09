import { useState } from "react";

export default function Admin() {
  const [pw, setPw] = useState("");
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(""); // 재채점 중인 ts 또는 "all"
  const [msg, setMsg] = useState("");

  async function load(e) {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/results?key=${encodeURIComponent(pw)}`);
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "불러오기 실패");
        setItems(null);
      } else {
        setItems(data.items);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function regradeOne(ts) {
    setBusy(String(ts));
    setMsg("");
    try {
      const r = await fetch(`/api/regrade?key=${encodeURIComponent(pw)}&ts=${ts}`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) {
        setMsg(`재채점 실패: ${data.error || r.status}`);
        return false;
      }
      setMsg(`재채점 완료: ${data.name} ${data.total}/${data.max}점`);
      return true;
    } catch (err) {
      setMsg("재채점 오류: " + String(err));
      return false;
    } finally {
      setBusy("");
    }
  }

  async function regradeOneAndReload(ts) {
    const ok = await regradeOne(ts);
    if (ok) await load();
  }

  async function regradeAllPending() {
    const pending = (items || []).filter((it) => it.status === "pending" && it.answers !== null);
    // answers는 목록에 없으므로 status로만 판단; 서버가 답안 없으면 422로 알려줌
    const targets = (items || []).filter((it) => it.status === "pending");
    if (!targets.length) {
      setMsg("보류 중인 항목이 없습니다.");
      return;
    }
    setBusy("all");
    let done = 0, skipped = 0, failed = 0;
    for (const it of targets) {
      try {
        const r = await fetch(`/api/regrade?key=${encodeURIComponent(pw)}&ts=${it.ts}`, { method: "POST" });
        const data = await r.json();
        if (r.ok) done++;
        else if (data.noAnswers) skipped++;
        else failed++;
        setMsg(`재채점 진행: 완료 ${done} · 건너뜀 ${skipped} · 실패 ${failed}`);
        await new Promise((res) => setTimeout(res, 1500)); // 한도 보호용 간격
      } catch (_) {
        failed++;
      }
    }
    setBusy("");
    await load();
    setMsg(`보류 재채점 완료 — 완료 ${done} · 건너뜀(답안없음) ${skipped} · 실패 ${failed}`);
  }

  function downloadCsv() {
    if (!items || !items.length) return;
    const head = ["이름", "학번", "제출시각", "상태", "총점", "만점", "자동채점", "서술형", "PDF"];
    const rows = items.map((it) => [
      it.name, it.studentId, it.submittedAt,
      it.status === "pending" ? "보류" : "완료",
      it.total, it.max, it.anchor, it.rubric, it.pdfUrl,
    ]);
    const csv = [head, ...rows]
      .map((row) => row.map((c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `시험결과_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const wrap = { maxWidth: 1100, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", color: "#1a1a1a" };

  if (!items) {
    return (
      <div style={wrap}>
        <h1 style={{ fontSize: 24 }}>교수 결과 페이지</h1>
        <p style={{ color: "#555" }}>비밀번호를 입력하면 제출된 시험 결과를 볼 수 있습니다.</p>
        <form onSubmit={load} style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호"
            style={{ flex: 1, padding: "10px 12px", fontSize: 16, border: "1px solid #ccc", borderRadius: 8 }} />
          <button type="submit" disabled={loading}
            style={{ padding: "10px 18px", fontSize: 16, borderRadius: 8, border: "none", background: "#111", color: "#fff", cursor: "pointer" }}>
            {loading ? "확인 중..." : "들어가기"}
          </button>
        </form>
        {error && <p style={{ color: "#c00", marginTop: 12 }}>{error}</p>}
      </div>
    );
  }

  const pendingCount = items.filter((it) => it.status === "pending").length;

  return (
    <div style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 24 }}>제출 결과 ({items.length}건){pendingCount > 0 && <span style={{ color: "#b45309", fontSize: 15, marginLeft: 8 }}>· 보류 {pendingCount}건</span>}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {pendingCount > 0 && (
            <button onClick={regradeAllPending} disabled={!!busy}
              style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#b45309", color: "#fff", cursor: "pointer" }}>
              {busy === "all" ? "재채점 중..." : `보류 ${pendingCount}건 전체 재채점`}
            </button>
          )}
          <button onClick={load} disabled={!!busy} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>새로고침</button>
          <button onClick={downloadCsv} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#111", color: "#fff", cursor: "pointer" }}>CSV 내려받기</button>
        </div>
      </div>

      {msg && <p style={{ marginTop: 12, padding: "8px 12px", background: "#f4f4f5", borderRadius: 8 }}>{msg}</p>}

      {items.length === 0 ? (
        <p style={{ color: "#555", marginTop: 24 }}>아직 제출된 결과가 없습니다.</p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f4f4f5", textAlign: "left" }}>
                <th style={th}>이름</th>
                <th style={th}>학번</th>
                <th style={th}>제출시각</th>
                <th style={th}>상태</th>
                <th style={{ ...th, textAlign: "right" }}>총점</th>
                <th style={{ ...th, textAlign: "right" }}>자동</th>
                <th style={{ ...th, textAlign: "right" }}>서술형</th>
                <th style={th}>PDF</th>
                <th style={th}>재채점</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.ts} style={{ borderBottom: "1px solid #eee", background: it.status === "pending" ? "#fffbeb" : "transparent" }}>
                  <td style={td}>{it.name}</td>
                  <td style={td}>{it.studentId}</td>
                  <td style={td}>{it.submittedAt}</td>
                  <td style={td}>
                    {it.status === "pending"
                      ? <span style={{ color: "#b45309", fontWeight: 600 }}>보류</span>
                      : <span style={{ color: "#15803d" }}>완료</span>}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{it.total} / {it.max}</td>
                  <td style={{ ...td, textAlign: "right" }}>{it.anchor}</td>
                  <td style={{ ...td, textAlign: "right" }}>{it.rubric}</td>
                  <td style={td}><a href={it.pdfUrl} target="_blank" rel="noreferrer">열기</a></td>
                  <td style={td}>
                    <button onClick={() => regradeOneAndReload(it.ts)} disabled={!!busy}
                      style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #b45309", background: "#fff", color: "#b45309", cursor: "pointer", fontSize: 13 }}>
                      {busy === String(it.ts) ? "..." : "재채점"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: "#777", fontSize: 12, marginTop: 12 }}>
            노란색 줄(보류)은 제출 당시 한도 등으로 서술형 채점이 안 된 항목입니다. 답안이 저장돼 있으면 "재채점"으로 복구됩니다.
            구버전(답안 미저장) 제출은 재채점이 불가하며, 그 경우 안내가 표시됩니다.
          </p>
        </div>
      )}
    </div>
  );
}

const th = { padding: "10px 12px", borderBottom: "2px solid #ddd", whiteSpace: "nowrap" };
const td = { padding: "8px 12px", whiteSpace: "nowrap" };
