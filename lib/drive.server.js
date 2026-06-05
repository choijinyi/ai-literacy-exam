// 서버 전용. 교수 계정 OAuth 리프레시 토큰으로 PDF를 교수 드라이브에 업로드.
import { google } from "googleapis";
import { Readable } from "stream";

export async function uploadToDrive(pdfBuffer, filename) {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN,
    GOOGLE_DRIVE_FOLDER_ID,
  } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error("구글 드라이브 자격증명(GOOGLE_*)이 설정되지 않았다.");
  }

  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

  const drive = google.drive({ version: "v3", auth: oauth2 });

  const fileMeta = { name: filename };
  if (GOOGLE_DRIVE_FOLDER_ID) fileMeta.parents = [GOOGLE_DRIVE_FOLDER_ID];

  const res = await drive.files.create({
    requestBody: fileMeta,
    media: {
      mimeType: "application/pdf",
      body: Readable.from(pdfBuffer),
    },
    fields: "id, name, webViewLink",
    supportsAllDrives: true,
  });

  return res.data; // { id, name, webViewLink }
}
