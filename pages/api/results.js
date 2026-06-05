// 교수 전용. 비밀번호 확인 후 저장된 결과 목록을 반환한다.
import { listResults } from "../../lib/store.server.js";

export default async function handler(req, res) {
  const pw = req.headers["x-admin-key"] || (req.query && req.query.key) || "";
  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
  }
  try {
    const items = await listResults();
    return res.status(200).json({ ok: true, count: items.length, items });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
