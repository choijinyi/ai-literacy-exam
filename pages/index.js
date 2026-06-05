import { useState, useEffect, useRef } from "react";
import {
  EXAM_META,
  QUESTIONS,
  DIM_OPTIONS,
} from "../lib/questions.public.js";

const RANKS = [1, 2, 3];

export default function Exam() {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(EXAM_META.durationMinutes * 60);
  const timerRef = useRef(null);

  // 타이머
  useEffect(() => {
    if (!started || result) return;
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          handleSubmit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line
  }, [started, result]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  function set(qid, value) {
    setAnswers((prev) => ({ ...prev, [qid]: { ...(prev[qid] || {}), ...value } }));
  }

  function start() {
    setError("");
    if (!name.trim() || !studentId.trim()) {
      setError("이름과 학번을 모두 입력해 주세요.");
      return;
    }
    setStarted(true);
  }

  async function handleSubmit(auto = false) {
    if (submitting || result) return;
    if (!auto) {
      const ok = window.confirm("답안을 저장하고 채점하시겠습니까? 저장 후에는 수정할 수 없습니다.");
      if (!ok) return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), studentId: studentId.trim(), answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "제출 실패");
      setResult(data);
      clearInterval(timerRef.current);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSubmitting(false);
    }
  }

  // ===== 결과 화면 =====
  if (result) {
    return (
      <div className="wrap">
        <div className="card result">
          <h1>채점 결과</h1>
          <p className="who">{name} · {studentId}</p>
          <div className="bigscore">{result.total} <span>/ {result.max}</span></div>
          <p className="sub">
            자동채점 {result.anchor.total}/{result.anchor.max} · 루브릭 {result.rubric.total}/{result.rubric.max}
          </p>
          <p className={result.saved ? "saved ok" : "saved warn"}>
            {result.saved
              ? "결과 PDF가 구글 드라이브에 저장되었습니다."
              : "점수는 산출되었으나 드라이브 저장에 실패했습니다. 감독관에게 알려 주세요."}
          </p>

          <div className="breakdown">
            {QUESTIONS.map((q) => {
              const b = result.perItem[q.id] || { score: 0, max: 0, reason: "" };
              return (
                <div key={q.id} className="brow">
                  <div className="btitle">{q.title}</div>
                  <div className="bscore">{b.score} / {b.max}</div>
                  {b.reason ? <div className="breason">{b.reason}</div> : null}
                </div>
              );
            })}
          </div>
        </div>
        <Style />
      </div>
    );
  }

  // ===== 시작 화면 =====
  if (!started) {
    return (
      <div className="wrap">
        <div className="card intro">
          <h1>{EXAM_META.title}</h1>
          <p className="subtitle">{EXAM_META.subtitle}</p>
          <p className="notice">{EXAM_META.notice}</p>
          <label>이름
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
          </label>
          <label>학번
            <input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="2026-00000" />
          </label>
          {error ? <p className="err">{error}</p> : null}
          <button className="primary" onClick={start}>시험 시작</button>
        </div>
        <Style />
      </div>
    );
  }

  // ===== 시험 화면 =====
  return (
    <div className="wrap">
      <div className="topbar">
        <div>{name} · {studentId}</div>
        <div className={seconds < 300 ? "timer low" : "timer"}>남은 시간 {mm}:{ss}</div>
      </div>

      <div className="exam">
        {QUESTIONS.map((q) => (
          <div className="card q" key={q.id}>
            <div className="qhead">
              <h2>{q.title}</h2>
              <span className="pts">{q.points}점</span>
            </div>
            <p className="qbody">{q.body}</p>
            <Question q={q} answers={answers} set={set} />
          </div>
        ))}

        {error ? <p className="err center">{error}</p> : null}
        <button className="primary big" disabled={submitting} onClick={() => handleSubmit(false)}>
          {submitting ? "채점 중입니다…" : "저장하고 채점하기"}
        </button>
        <p className="footnote">저장을 누르면 즉시 채점되어 점수가 표시되고, 결과 PDF가 구글 드라이브에 저장됩니다.</p>
      </div>
      <Style />
    </div>
  );
}

// ===== 문항별 입력 컴포넌트 =====
function Question({ q, answers, set }) {
  const a = answers[q.id] || {};

  if (q.type === "prompt3") {
    const prompts = a.prompts || ["", "", ""];
    const dims = a.dims || ["", "", ""];
    return (
      <div className="fields">
        {[0, 1, 2].map((i) => (
          <div key={i} className="round">
            <div className="roundlabel">{i + 1}차 프롬프트</div>
            <textarea
              rows={3}
              value={prompts[i]}
              onChange={(e) => {
                const np = [...prompts]; np[i] = e.target.value;
                set(q.id, { prompts: np });
              }}
            />
            <div className="dimrow">
              <span>이번 차수에서 바꾼 핵심 요소:</span>
              {DIM_OPTIONS.map((d) => (
                <label key={d} className="chip">
                  <input
                    type="radio"
                    name={`${q.id}-dim-${i}`}
                    checked={dims[i] === d}
                    onChange={() => { const nd = [...dims]; nd[i] = d; set(q.id, { dims: nd }); }}
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>
        ))}
        <label className="block">출력이 어떻게 달라졌는지 비교
          <textarea rows={3} value={a.compare || ""} onChange={(e) => set(q.id, { compare: e.target.value })} />
        </label>
      </div>
    );
  }

  if (q.type === "errorhunt") {
    const errs = a.errors || [];
    const urls = a.urls || ["", "", "", ""];
    return (
      <div className="fields">
        <div className="passage">
          {q.sentences.map((s, idx) => {
            const num = idx + 1;
            const checked = errs.includes(num);
            return (
              <label key={num} className={`sentence ${checked ? "marked" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked ? errs.filter((n) => n !== num) : [...errs, num];
                    set(q.id, { errors: next });
                  }}
                />
                {s}
              </label>
            );
          })}
        </div>
        <div className="urls">
          {[0, 1, 2, 3].map((i) => (
            <input key={i} placeholder={`출처 URL/DOI ${i + 1}`} value={urls[i]}
              onChange={(e) => { const nu = [...urls]; nu[i] = e.target.value; set(q.id, { urls: nu }); }} />
          ))}
        </div>
        <label className="block">정정문(각 오류를 바르게 고쳐 적기)
          <textarea rows={4} value={a.corrections || ""} onChange={(e) => set(q.id, { corrections: e.target.value })} />
        </label>
      </div>
    );
  }

  if (q.type === "rank3") {
    const ranks = a.ranks || {};
    return (
      <div className="fields">
        {q.options.map((o) => (
          <div key={o.key} className="rankopt">
            <div className="optkey">{o.key}</div>
            <div className="opttext">{o.text}</div>
            <select value={ranks[o.key] || ""} onChange={(e) => set(q.id, { ranks: { ...ranks, [o.key]: e.target.value } })}>
              <option value="">순위</option>
              {RANKS.map((r) => <option key={r} value={r}>{r}위</option>)}
            </select>
          </div>
        ))}
        <label className="block">순위 근거(네 기준에 비추어)
          <textarea rows={3} value={a.reason || ""} onChange={(e) => set(q.id, { reason: e.target.value })} />
        </label>
        <label className="block">가장 약한 출력을 끌어올릴 수정 프롬프트(한 줄)
          <input value={a.fix || ""} onChange={(e) => set(q.id, { fix: e.target.value })} />
        </label>
      </div>
    );
  }

  if (q.type === "longtext") {
    return (
      <label className="block">
        <textarea rows={9} placeholder={q.placeholder || ""} value={a.workflow || ""}
          onChange={(e) => set(q.id, { workflow: e.target.value })} />
      </label>
    );
  }

  if (q.type === "promo") {
    const checks = a.checks || [false, false, false, false];
    const figures = a.figures || ["", ""];
    const len = [...(a.promo || "")].length;
    return (
      <div className="fields">
        <table className="dtable">
          <thead><tr>{q.table.header.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{q.table.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
        <label className="block">홍보 문구 <span className={len > 250 ? "count over" : "count"}>{len}/250자</span>
          <textarea rows={4} value={a.promo || ""} onChange={(e) => set(q.id, { promo: e.target.value })} />
        </label>
        <div className="checks">
          {q.checklist.map((c, i) => (
            <label key={i} className="checkrow">
              <input type="checkbox" checked={checks[i]} onChange={() => { const nc = [...checks]; nc[i] = !nc[i]; set(q.id, { checks: nc }); }} />
              {c}
            </label>
          ))}
        </div>
        <div className="figs">
          <input placeholder="인용한 수치 1 (예: 52%)" value={figures[0]} onChange={(e) => { const nf = [...figures]; nf[0] = e.target.value; set(q.id, { figures: nf }); }} />
          <input placeholder="인용한 수치 2 (예: 610명)" value={figures[1]} onChange={(e) => { const nf = [...figures]; nf[1] = e.target.value; set(q.id, { figures: nf }); }} />
        </div>
      </div>
    );
  }

  if (q.type === "reverse") {
    return (
      <div className="fields">
        <blockquote className="example">{q.quote}</blockquote>
        <label className="block">복원한 프롬프트
          <textarea rows={4} value={a.restore || ""} onChange={(e) => set(q.id, { restore: e.target.value })} />
        </label>
        <label className="block">구성 요소 분해
          <textarea rows={3} value={a.decompose || ""} onChange={(e) => set(q.id, { decompose: e.target.value })} />
        </label>
        <label className="block">일반화 템플릿(치환 변수는 [대괄호]로 표시)
          <textarea rows={3} value={a.template || ""} onChange={(e) => set(q.id, { template: e.target.value })} />
        </label>
      </div>
    );
  }

  if (q.type === "toolmatch") {
    const tools = a.tools || {};
    return (
      <div className="fields">
        {q.tasks.map((t) => (
          <div key={t.key} className="taskrow">
            <div className="tasklabel">{t.label}</div>
            <select value={tools[t.key] || ""} onChange={(e) => set(q.id, { tools: { ...tools, [t.key]: e.target.value } })}>
              <option value="">도구 선택</option>
              {q.toolOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <label className="block">선택 이유(각 과업마다 한 줄씩)
          <textarea rows={4} value={a.reasons || ""} onChange={(e) => set(q.id, { reasons: e.target.value })} />
        </label>
      </div>
    );
  }

  if (q.type === "evidence") {
    const claims = a.claims || {};
    return (
      <div className="fields">
        <blockquote className="example">{q.source}</blockquote>
        {q.claims.map((c) => (
          <div key={c.key} className="claimrow">
            <div className="claimtext">{c.text}</div>
            <div className="claimbtns">
              {[["has", "근거 있음"], ["none", "근거 없음"]].map(([v, label]) => (
                <label key={v} className={`chip ${claims[c.key] === v ? "on" : ""}`}>
                  <input type="radio" name={`${q.id}-${c.key}`} checked={claims[c.key] === v}
                    onChange={() => set(q.id, { claims: { ...claims, [c.key]: v } })} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        ))}
        <label className="block">근거 없는 문장은 무엇이 문제인지 설명
          <textarea rows={3} value={a.explain || ""} onChange={(e) => set(q.id, { explain: e.target.value })} />
        </label>
      </div>
    );
  }

  if (q.type === "ethics") {
    const risks = a.risks || [];
    return (
      <div className="fields">
        <div className="checks">
          {q.riskOptions.map((o) => {
            const on = risks.includes(o);
            return (
              <label key={o} className="checkrow">
                <input type="checkbox" checked={on} onChange={() => {
                  const next = on ? risks.filter((r) => r !== o) : [...risks, o];
                  set(q.id, { risks: next });
                }} />
                {o}
              </label>
            );
          })}
        </div>
        <label className="block">안전한 대안 워크플로(비식별화 절차 포함)
          <textarea rows={4} value={a.alternative || ""} onChange={(e) => set(q.id, { alternative: e.target.value })} />
        </label>
      </div>
    );
  }

  if (q.type === "diagnose") {
    return (
      <div className="fields">
        <div className="failbox">
          <div><b>프롬프트:</b> {q.failPrompt}</div>
          <div><b>출력:</b> {q.failOutput}</div>
        </div>
        <label className="block">실패 원인 진단(한 문장)
          <input value={a.diagnosis || ""} onChange={(e) => set(q.id, { diagnosis: e.target.value })} />
        </label>
        <label className="block">수정 프롬프트
          <textarea rows={3} value={a.fix || ""} onChange={(e) => set(q.id, { fix: e.target.value })} />
        </label>
      </div>
    );
  }

  return null;
}

// ===== 스타일 =====
function Style() {
  return (
    <style jsx global>{`
      * { box-sizing: border-box; }
      body { margin: 0; background: #f4f6fa; color: #1c2430;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; }
      .wrap { max-width: 820px; margin: 0 auto; padding: 24px 16px 80px; }
      .card { background: #fff; border: 1px solid #e3e8f0; border-radius: 14px; padding: 24px; margin-bottom: 18px;
        box-shadow: 0 1px 2px rgba(20,40,80,.04); }
      h1 { font-size: 24px; margin: 0 0 6px; }
      h2 { font-size: 17px; margin: 0; }
      .subtitle { color: #5a6b85; margin: 0 0 16px; }
      .notice { background: #f0f5ff; border: 1px solid #d6e4ff; border-radius: 10px; padding: 14px;
        font-size: 14px; line-height: 1.6; color: #2b3f63; }
      label { display: block; font-size: 14px; margin-top: 14px; font-weight: 600; color: #2b3647; }
      input, textarea, select { width: 100%; margin-top: 6px; padding: 10px 12px; font-size: 15px;
        border: 1px solid #cdd5e2; border-radius: 9px; font-family: inherit; background: #fff; color: #1c2430; }
      textarea { resize: vertical; line-height: 1.6; }
      input:focus, textarea:focus, select:focus { outline: none; border-color: #3b6fd4; box-shadow: 0 0 0 3px rgba(59,111,212,.12); }
      .primary { margin-top: 20px; width: 100%; padding: 13px; font-size: 16px; font-weight: 700; color: #fff;
        background: #2c5fcc; border: 0; border-radius: 10px; cursor: pointer; }
      .primary:hover { background: #234fad; }
      .primary:disabled { background: #9bb0d8; cursor: default; }
      .primary.big { margin-top: 8px; }
      .err { color: #c0392b; font-weight: 600; margin-top: 12px; }
      .err.center { text-align: center; }
      .topbar { position: sticky; top: 0; z-index: 5; display: flex; justify-content: space-between; align-items: center;
        background: #fff; border: 1px solid #e3e8f0; border-radius: 12px; padding: 12px 18px; margin-bottom: 16px;
        font-size: 14px; font-weight: 600; box-shadow: 0 2px 6px rgba(20,40,80,.06); }
      .timer { color: #2c5fcc; }
      .timer.low { color: #c0392b; }
      .qhead { display: flex; justify-content: space-between; align-items: baseline; }
      .pts { font-size: 13px; color: #2c5fcc; font-weight: 700; background: #eef3ff; padding: 3px 10px; border-radius: 20px; }
      .qbody { font-size: 14.5px; line-height: 1.65; color: #34425a; margin: 10px 0 16px; }
      .fields { display: flex; flex-direction: column; gap: 4px; }
      .block { font-weight: 600; }
      .round { border: 1px dashed #d3dcec; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
      .roundlabel { font-weight: 700; font-size: 13px; color: #2c5fcc; margin-bottom: 4px; }
      .dimrow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; font-size: 13px; color: #5a6b85; }
      .chip { display: inline-flex; align-items: center; gap: 4px; font-weight: 500; font-size: 13px; margin: 0;
        background: #f1f4fa; padding: 5px 10px; border-radius: 16px; cursor: pointer; border: 1px solid transparent; }
      .chip input { width: auto; margin: 0; }
      .chip.on { background: #2c5fcc; color: #fff; }
      .passage { display: flex; flex-direction: column; gap: 2px; margin-bottom: 12px; }
      .sentence { display: flex; gap: 10px; align-items: flex-start; font-weight: 400; font-size: 14px; line-height: 1.6;
        padding: 8px 10px; border-radius: 8px; cursor: pointer; margin: 0; }
      .sentence:hover { background: #f7f9fd; }
      .sentence.marked { background: #fff3f0; }
      .sentence input { width: auto; margin: 3px 0 0; }
      .urls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .urls input { margin-top: 0; }
      .rankopt { display: grid; grid-template-columns: 30px 1fr 90px; gap: 10px; align-items: center;
        border: 1px solid #e3e8f0; border-radius: 10px; padding: 10px; margin-bottom: 8px; }
      .optkey { font-weight: 800; color: #2c5fcc; text-align: center; }
      .opttext { font-size: 13.5px; line-height: 1.55; }
      .rankopt select { margin-top: 0; }
      .dtable { width: 100%; border-collapse: collapse; font-size: 13.5px; margin-bottom: 8px; }
      .dtable th, .dtable td { border: 1px solid #dde3ee; padding: 7px 9px; text-align: center; }
      .dtable th { background: #f1f4fa; }
      .checks { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
      .checkrow { display: flex; gap: 9px; align-items: center; font-weight: 500; font-size: 14px; margin: 0; }
      .checkrow input { width: auto; margin: 0; }
      .figs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
      .figs input { margin-top: 0; }
      .count { font-size: 12px; color: #8a97ac; font-weight: 500; }
      .count.over { color: #c0392b; }
      .example, .failbox { background: #f7f9fd; border-left: 4px solid #b9c8e6; border-radius: 6px;
        padding: 12px 14px; font-size: 14px; line-height: 1.65; color: #2b3647; margin: 6px 0 4px; }
      .failbox > div { margin: 3px 0; }
      .taskrow { display: grid; grid-template-columns: 1fr 200px; gap: 10px; align-items: center; margin-bottom: 8px; }
      .tasklabel { font-size: 14px; }
      .taskrow select { margin-top: 0; }
      .claimrow { border: 1px solid #e3e8f0; border-radius: 10px; padding: 10px 12px; margin-bottom: 7px; }
      .claimtext { font-size: 14px; margin-bottom: 8px; }
      .claimbtns { display: flex; gap: 8px; }
      .footnote { text-align: center; font-size: 12.5px; color: #8a97ac; margin-top: 14px; }
      /* 결과 */
      .result { text-align: center; }
      .who { color: #5a6b85; margin: 0 0 14px; }
      .bigscore { font-size: 52px; font-weight: 800; color: #2c5fcc; line-height: 1.1; }
      .bigscore span { font-size: 24px; color: #9bb0d8; font-weight: 700; }
      .sub { color: #5a6b85; margin: 6px 0 14px; }
      .saved { font-size: 14px; padding: 10px; border-radius: 9px; }
      .saved.ok { background: #eafaf0; color: #1e7e45; }
      .saved.warn { background: #fff3f0; color: #c0392b; }
      .breakdown { text-align: left; margin-top: 22px; }
      .brow { border-top: 1px solid #eef1f7; padding: 12px 2px; }
      .btitle { font-weight: 600; font-size: 14px; }
      .bscore { color: #2c5fcc; font-weight: 700; font-size: 15px; }
      .breason { color: #6b7890; font-size: 13px; margin-top: 3px; line-height: 1.5; }
      @media (max-width: 560px) {
        .urls, .figs { grid-template-columns: 1fr; }
        .taskrow { grid-template-columns: 1fr; }
        .rankopt { grid-template-columns: 24px 1fr; }
        .rankopt select { grid-column: 1 / -1; }
      }
    `}</style>
  );
}
