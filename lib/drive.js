import { google } from "googleapis";
import { Readable } from "stream";

let cachedDriveClient = null;

function assertEnv() {
  const required = [
    "GOOGLE_SHEETS_CLIENT_EMAIL",
    "GOOGLE_SHEETS_PRIVATE_KEY",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Missing environment variable(s): ${missing.join(
        ", "
      )} for Google Drive upload.`
    );
  }
}

async function getDriveClient() {
  if (cachedDriveClient) return cachedDriveClient;
  assertEnv();
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  await auth.authorize();
  cachedDriveClient = google.drive({ version: "v3", auth });
  return cachedDriveClient;
}

export async function uploadPhotoToDrive({ filename, dataUrl }) {
  try {
    const drive = await getDriveClient();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      throw new Error(
        "GOOGLE_DRIVE_FOLDER_ID is missing in environment variables. Service accounts cannot store files in their root Drive; please set GOOGLE_DRIVE_FOLDER_ID to a folder shared with the service account."
      );
    }

    // Parse dataUrl
    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error("Invalid dataUrl format");
    }
    const mimeType = matches[1];
    const base64Data = matches[2];

    const buffer = Buffer.from(base64Data, "base64");
    const stream = Readable.from(buffer);

    const fileMetadata = {
      name: filename,
      parents: folderId ? [folderId] : undefined,
    };

    const media = {
      mimeType: mimeType,
      body: stream,
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
      supportsAllDrives: true,
    });

    const fileId = file.data.id;

    // Make file readable to anyone with link so the app can display it
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });

    return {
      ok: true,
      fileId,
      url: `https://drive.google.com/uc?export=view&id=${fileId}`,
    };
  } catch (err) {
    console.warn("[drive] Photo upload to Drive failed:", err.message);
    return {
      ok: false,
      error: err.message,
      isQuotaError: err.message?.includes("storage quota"),
    };
  }
}
