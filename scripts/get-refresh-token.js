// 구글 드라이브 리프레시 토큰을 1회 발급받는 보조 스크립트.
// 사용법:
//   1) .env.local 에 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET 을 먼저 넣는다.
//   2) 터미널에서:  node scripts/get-refresh-token.js
//   3) 출력된 URL을 브라우저로 열어 교수 본인 구글 계정으로 로그인·동의한다.
//   4) 리디렉션된 주소(http://localhost:53682/?code=...)에서 code 값을 복사해 터미널에 붙여넣는다.
//   5) 출력된 refresh_token 을 .env.local 및 Vercel 환경변수에 넣는다.

const http = require("http");
const { google } = require("googleapis");
const readline = require("readline");

// .env.local 직접 로딩(의존성 없이)
try {
  const fs = require("fs");
  const env = fs.readFileSync(".env.local", "utf8");
  env.split("\n").forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
} catch (_) {}

const REDIRECT = "http://localhost:53682";
const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT
);

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error("먼저 .env.local 에 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET 을 넣어 주세요.");
  process.exit(1);
}

const url = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/drive.file"],
});

console.log("\n아래 URL을 브라우저에서 열고 교수 본인 계정으로 동의하세요:\n");
console.log(url + "\n");

// 로컬 서버로 code 자동 수신
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, REDIRECT);
  const code = u.searchParams.get("code");
  if (!code) { res.end("code 없음"); return; }
  res.end("인증 완료. 터미널로 돌아가세요.");
  server.close();
  try {
    const { tokens } = await oauth2.getToken(code);
    console.log("\n===== 발급 결과 =====");
    console.log("GOOGLE_REFRESH_TOKEN=" + (tokens.refresh_token || "(없음 - prompt=consent 재시도)"));
    console.log("=====================\n");
  } catch (e) {
    console.error("토큰 교환 실패:", e.message);
  }
  process.exit(0);
});
server.listen(53682, () => {});

// 수동 입력 대비
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("자동 수신이 안 되면 주소의 code 값을 붙여넣으세요(엔터로 건너뜀): ", async (code) => {
  if (code.trim()) {
    try {
      const { tokens } = await oauth2.getToken(code.trim());
      console.log("\nGOOGLE_REFRESH_TOKEN=" + tokens.refresh_token + "\n");
    } catch (e) { console.error(e.message); }
    process.exit(0);
  }
});
