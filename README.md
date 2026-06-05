# AI 활용 능력 시험 (웹앱)

학생이 이름·학번을 적고 10문항에 답한 뒤 "저장하고 채점하기"를 누르면, 즉시 채점되어 점수가 화면에 표시되고 결과 PDF가 교수 구글 드라이브에 저장된다. Vercel에 배포해 링크만 학생에게 나눠 주면 된다.

## 채점 구조

- **자동채점(앵커) 51점**: 체크박스·순위·드롭다운·글자수·수치 일치 등 결정론적 규칙으로 즉시 채점.
- **루브릭 채점(LLM) 49점**: 서술형 답안을 서버에서 Anthropic API로 채점. 키는 서버에만 두어 노출되지 않는다.
- 정답키와 채점 기준은 `lib/*.server.js`에만 있고 학생 브라우저로 내려가지 않는다.

## 폴더 구조

```
lib/questions.public.js   문제 본문(공개)
lib/scoring.server.js      앵커 정답키·채점(서버 전용)
lib/rubrics.server.js      LLM 루브릭 기준문·채점기 호출(서버 전용)
lib/pdf.server.js          결과 PDF 생성(한글 폰트 런타임 로드)
lib/drive.server.js        구글 드라이브 업로드
pages/index.js             학생 시험 화면
pages/api/submit.js        저장 시 채점·PDF·업로드 처리
scripts/get-refresh-token.js  구글 리프레시 토큰 발급 보조
```

---

## 준비 1. Anthropic API 키

1. console.anthropic.com 에서 API 키를 발급한다.
2. 환경변수 `ANTHROPIC_API_KEY` 에 넣는다. (채점 모델은 기본 `claude-sonnet-4-6`, 바꾸려면 `GRADER_MODEL`)

## 준비 2. 구글 드라이브 (결과 저장용, 교수 계정)

학생이 교수 드라이브에 로그인할 수 없으므로, 교수 계정의 권한을 서버에 한 번만 위임한다.

1. console.cloud.google.com 에서 프로젝트 생성 → **Google Drive API** 사용 설정.
2. **OAuth 동의 화면** 구성(외부, 테스트 사용자에 교수 본인 이메일 추가).
3. **사용자 인증 정보 → OAuth 클라이언트 ID → 데스크톱 앱** 생성.
   - 클라이언트 ID / 시크릿을 받는다.
4. 결과를 모을 드라이브 폴더를 하나 만들고, 폴더 URL 끝의 ID를 복사한다.
   (`https://drive.google.com/drive/folders/【이부분】`)
5. 프로젝트 루트에 `.env.local` 을 만들고 `.env.local.example` 을 참고해 채운다.
   최소한 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 먼저 입력.
6. 리프레시 토큰 발급:
   ```
   npm install
   npm run get-token
   ```
   출력된 URL을 브라우저로 열어 **교수 본인 구글 계정**으로 동의한다.
   터미널에 `GOOGLE_REFRESH_TOKEN=...` 이 출력되면 복사한다.
7. `.env.local` 에 `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID` 까지 모두 채운다.

> 권한 범위는 `drive.file`로 제한되어, 이 앱이 만든 파일만 접근한다(교수의 다른 드라이브 파일은 건드리지 않는다).

## 준비 3. 로컬 실행(선택)

```
npm install
npm run dev
```
http://localhost:3000 에서 동작 확인.

---

## 배포 (Vercel)

1. 이 폴더를 GitHub 저장소에 올린다. (`.env.local` 은 `.gitignore`로 제외됨 — 절대 커밋하지 말 것)
2. vercel.com 에서 New Project → 해당 저장소 import.
3. **Environment Variables** 에 다음을 모두 등록한다.
   - `ANTHROPIC_API_KEY`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID`
   - (선택) `GRADER_MODEL`, `KR_FONT_URL`
4. Deploy. 발급된 `https://...vercel.app` 링크를 학생에게 배포한다.

## 운영 메모

- 루브릭 점수는 AI 채점기 결과로 ±1점 편차가 있을 수 있다. PDF 하단에 안내 문구가 들어가며, 최종 점수는 교수 검토 후 확정하면 된다.
- 한 번의 제출에 LLM 호출 10회가 병렬로 일어난다. 채점 비용·시간은 Sonnet 기준 응시자당 수 초·수십 원 수준이다. 비용을 더 낮추려면 `GRADER_MODEL=claude-haiku-4-5-20251001` 로 바꿀 수 있다.
- 문항·정답을 고치려면 `lib/questions.public.js`(본문)와 `lib/scoring.server.js`·`lib/rubrics.server.js`(정답·기준)를 함께 수정한다.
- 드라이브 저장이 실패해도 학생 화면에는 점수가 표시되고, 실패 사실이 함께 안내된다.
