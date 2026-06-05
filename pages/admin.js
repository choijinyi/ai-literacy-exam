import { useState } from "react";

export default function Admin() {
  const [pw, setPw] = useState("");
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  function downloadCsv() {
    if (!items || !items.length) return;
    const head = ["이름", "학번", "제출시각", "총점", "만점", "자동채점", "서술형", "PDF"];
    const rows = items.map((it) => [
      it.name,
      it.studentId,
      it.submittedAt,
      it.total,
      it.max,
      it.anchor,
      it.rubric,
      it.pdfUrl,
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

  const wrap = { maxWidth: 1000, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", color: "#1a1a1a" };

  if (!items) {
    return (
      <div style={wrap}>
        <h1 style={{ fontSize: 24 }}>교수 결과 페이지</h1>
        <p style={{ color: "#555" }}>비밀번호를 입력하면 제출된 시험 결과를 볼 수 있습니다.</p>
        <form onSubmit={load} style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="비밀번호"
            style={{ flex: 1, padding: "10px 12px", fontSize: 16, border: "1px solid #ccc", borderRadius: 8 }}
          />
          <button type="submit" disabled={loading} style={{ padding: "10px 18px", fontSize: 16, borderRadius: 8, border: "none", background: "#111", color: "#fff", cursor: "pointer" }}>
            {loading ? "확인 중..." : "들어가기"}
          </button>
        </form>
        {error && <p style={{ color: "#c00", marginTop: 12 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 24 }}>제출 결과 ({items.length}건)</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>새로고침</button>
          <button onClick={downloadCsv} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#111", color: "#fff", cursor: "pointer" }}>CSV 내려받기</button>
        </div>
      </div>
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
                <th style={{ ...th, textAlign: "right" }}>총점</th>
                <th style={{ ...th, textAlign: "right" }}>자동</th>
                <th style={{ ...th, textAlign: "right" }}>서술형</th>
                <th style={th}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.ts} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={td}>{it.name}</td>
                  <td style={td}>{it.studentId}</td>
                  <td style={td}>{it.submittedAt}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{it.total} / {it.max}</td>
                  <td style={{ ...td, textAlign: "right" }}>{it.anchor}</td>
                  <td style={{ ...td, textAlign: "right" }}>{it.rubric}</td>
                  <td style={td}><a href={it.pdfUrl} target="_blank" rel="noreferrer">열기</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th = { padding: "10px 12px", borderBottom: "2px solid #ddd", whiteSpace: "nowrap" };
const td = { padding: "8px 12px", whiteSpace: "nowrap" };
