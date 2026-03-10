import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import archiver from "archiver";
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

const CREDENTIALS_PATH = path.resolve("credentials.json");
const TOKEN_PATH = path.resolve("token.json");

const MAYORISTAS_PATH = path.resolve("mayoristas.json");

// Carpeta específica para el día
function getDayFolder() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DAY_FOLDER = getDayFolder();
const OUT_DIR = path.resolve("ficheros", DAY_FOLDER);
const ZIPS_DIR = path.resolve("zips");

const TO_EMAIL = "lnpcontable@gmail.com";
if (!TO_EMAIL) {
  console.error('Falta TO_EMAIL. Ejemplo: export TO_EMAIL="tuemail@dominio.com"');
  process.exit(1);
}

// Generar fecha de hoy en formato YYYY/MM/DD para Gmail
function getTodayDateForGmail() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

// Generar fecha de mañana para el filtro "before"
function getTomorrowDateForGmail() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

// Query para correos del día actual solamente
const todayDate = getTodayDateForGmail();
const tomorrowDate = getTomorrowDateForGmail();
const QUERY = `from:anubisgestion.com has:attachment after:${todayDate} before:${tomorrowDate}`;

console.log(`Buscando correos del día: ${todayDate}`);
console.log(`Query de Gmail: ${QUERY}`);

// Cargar mayoristas (número -> empresa)
const MAYORISTAS = JSON.parse(fs.readFileSync(MAYORISTAS_PATH, "utf-8"));

// Troceo por tamaño (para evitar límite de adjuntos Gmail)
const MAX_ZIP_MB = 18;
const MAX_ZIP_BYTES = MAX_ZIP_MB * 1024 * 1024;

function base64UrlToBuffer(data) {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

function bufferToBase64Url(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function safeSegment(s, maxLen = 120) {
  const cleaned = (s || "unknown")
    .trim()
    .replace(/[^\w\-\. @()+]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, maxLen)
    .trim();
  return cleaned || "unknown";
}

function headerValue(headers, name) {
  const h = (headers || []).find(
    (x) => (x.name || "").toLowerCase() === name.toLowerCase()
  );
  return h?.value || "";
}

function parseFrom(fromHeader) {
  const m = (fromHeader || "").match(/<([^>]+)>/);
  return (m ? m[1] : fromHeader).trim();
}

// Extrae "027" de "may027@anubisgestion.com"
function senderNumber(fromHeader) {
  const email = parseFrom(fromHeader).toLowerCase();
  const m = email.match(/^may(\d{3})@anubisgestion\.com$/);
  return m ? m[1] : null;
}

// Devuelve carpeta-empresa a partir del remitente
function companyFolderFromSender(fromHeader) {
  const num = senderNumber(fromHeader);
  if (!num) return "desconocido";

  const company = MAYORISTAS[num];
  if (!company) return num;

  return safeSegment(company, 80);
}

function* walkParts(part) {
  yield part;
  const parts = part?.parts || [];
  for (const p of parts) yield* walkParts(p);
}

async function loadSavedCredentialsIfExist() {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  try {
    const content = await fsp.readFile(TOKEN_PATH, "utf-8");
    if (!content.trim()) return null;
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch {
    await fsp.unlink(TOKEN_PATH).catch(() => {});
    return null;
  }
}

async function saveCredentials(client) {
  const content = await fsp.readFile(CREDENTIALS_PATH, "utf-8");
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;

  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });

  await fsp.writeFile(TOKEN_PATH, payload, "utf-8");
}

async function authorize() {
  const cached = await loadSavedCredentialsIfExist();
  if (cached) return cached;

  const content = await fsp.readFile(CREDENTIALS_PATH, "utf-8");
  const keys = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = keys.installed || keys.web;

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("Autoriza aquí:", authUrl);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise((resolve) => rl.question("Pega el código aquí: ", resolve));
  rl.close();

  const { tokens } = await oAuth2Client.getToken(code.trim());
  oAuth2Client.setCredentials(tokens);

  await saveCredentials(oAuth2Client);
  return oAuth2Client;
}

async function listAllMessageIds(gmail, q) {
  const ids = [];
  let pageToken = undefined;

  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      q,
      pageToken,
      maxResults: 500,
      includeSpamTrash: false,
    });

    const msgs = res.data.messages || [];
    for (const m of msgs) ids.push(m.id);

    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return ids;
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function saveAttachment({ gmail, messageId, attachmentId, targetPath }) {
  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });

  const data = res.data.data;
  if (!data) return false;

  // Evitar duplicar si ya existe
  if (fs.existsSync(targetPath)) return false;

  const buf = base64UrlToBuffer(data);
  await ensureDir(path.dirname(targetPath));
  await fsp.writeFile(targetPath, buf);
  return true;
}

// Listado recursivo de PDFs dentro de la carpeta de la empresa
async function listPdfFilesRecursive(dir, empresaFolder = '') {
  const out = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);

    if (e.isDirectory()) {
      out.push(...(await listPdfFilesRecursive(full, empresaFolder)));
      continue;
    }

    if (e.isFile() && e.name.toLowerCase().endsWith(".pdf")) {
      const st = await fsp.stat(full);
      const relPath = empresaFolder 
        ? path.join(empresaFolder, path.relative(dir, full))
        : path.relative(dir, full);
      
      out.push({
        fullPath: full,
        relPath: relPath,
        size: st.size,
      });
    }
  }

  return out;
}

// Agrupa PDFs en lotes con tamaño total máximo (aprox)
function chunkByTotalSize(files, maxBytes) {
  const chunks = [];
  let current = [];
  let currentBytes = 0;

  for (const f of files) {
    // Si un PDF ya es mayor que el límite, va solo (aunque probablemente no se pueda adjuntar)
    if (f.size > maxBytes) {
      if (current.length) chunks.push(current);
      chunks.push([f]);
      current = [];
      currentBytes = 0;
      continue;
    }

    if (currentBytes + f.size > maxBytes && current.length) {
      chunks.push(current);
      current = [f];
      currentBytes = f.size;
    } else {
      current.push(f);
      currentBytes += f.size;
    }
  }

  if (current.length) chunks.push(current);
  return chunks;
}

// Zipea una lista concreta de ficheros
async function zipFiles(fileList, outZipPath) {
  await ensureDir(path.dirname(outZipPath));

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outZipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);

    archive.on("warning", (err) => {
      if (err.code !== "ENOENT") reject(err);
    });
    archive.on("error", reject);

    archive.pipe(output);

    for (const f of fileList) {
      archive.file(f.fullPath, { name: f.relPath.replaceAll("\\", "/") });
    }

    archive.finalize();
  });
}

function buildRawEmailWithAttachment({ to, subject, text, attachmentPath, attachmentName }) {
  const boundary = `=_BOUNDARY_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const attachmentBytes = fs.readFileSync(attachmentPath);
  const attachmentB64 = attachmentBytes.toString("base64");

  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    text,
    "",
    `--${boundary}`,
    `Content-Type: application/zip; name="${attachmentName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${attachmentName}"`,
    "",
    attachmentB64,
    "",
    `--${boundary}--`,
    "",
  ];

  const raw = lines.join("\r\n");
  return bufferToBase64Url(Buffer.from(raw, "utf-8"));
}

async function sendZipByEmail(gmail, { to, date, zipPath, empresasCount }) {
  const subject = `Facturas del día ${date}`;
  const text = `Adjunto ZIP con las facturas de ${empresasCount} mayorista(s) del día ${date}.`;
  const attachmentName = path.basename(zipPath);

  const raw = buildRawEmailWithAttachment({
    to,
    subject,
    text,
    attachmentPath: zipPath,
    attachmentName,
  });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

async function main() {
  await ensureDir(OUT_DIR);
  await ensureDir(ZIPS_DIR);

  console.log(`Carpeta de descarga del día: ${OUT_DIR}`);

  const auth = await authorize();
  const gmail = google.gmail({ version: "v1", auth });

  const messageIds = await listAllMessageIds(gmail, QUERY);
  console.log(`Mensajes encontrados del día ${todayDate}: ${messageIds.length}`);

  if (messageIds.length === 0) {
    console.log("No hay correos del día de hoy. Finalizando.");
    return;
  }

  const companiesWithDownloads = new Set();
  let savedCount = 0;

  for (const messageId of messageIds) {
    const msgRes = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const payload = msgRes.data.payload;
    const headers = payload?.headers || [];

    const fromHeader = headerValue(headers, "From");
    const companyFolder = companyFolderFromSender(fromHeader);

    const root = payload || {};
    for (const part of walkParts(root)) {
      const filename = part?.filename || "";
      const attachmentId = part?.body?.attachmentId;

      if (!filename || !attachmentId) continue;
      if (!filename.toLowerCase().endsWith(".pdf")) continue;

      const safeFile = safeSegment(filename, 160);
      const targetPath = path.join(OUT_DIR, companyFolder, safeFile);

      const saved = await saveAttachment({
        gmail,
        messageId,
        attachmentId,
        targetPath,
      });

      if (saved) {
        savedCount += 1;
        companiesWithDownloads.add(companyFolder);
        console.log("Guardado:", targetPath);
      }
    }
  }

  console.log(`Adjuntos guardados: ${savedCount}`);

  // Recopilar todos los PDFs de todas las empresas
  if (companiesWithDownloads.size === 0) {
    console.log("No se descargaron archivos. Finalizando.");
    return;
  }

  console.log(`Creando ZIP único con ${companiesWithDownloads.size} mayorista(s)...`);
  
  const allPdfs = [];
  
  for (const empresa of companiesWithDownloads) {
    const sourceDir = path.join(OUT_DIR, empresa);
    if (!fs.existsSync(sourceDir)) continue;

    const pdfs = await listPdfFilesRecursive(sourceDir, empresa);
    allPdfs.push(...pdfs);
    console.log(`  ${empresa}: ${pdfs.length} PDF(s)`);
  }

  if (allPdfs.length === 0) {
    console.log("No hay PDFs para crear ZIP. Finalizando.");
    return;
  }

  allPdfs.sort((a, b) => a.relPath.localeCompare(b.relPath));

  const chunks = chunkByTotalSize(allPdfs, MAX_ZIP_BYTES);
  console.log(`Total: ${allPdfs.length} PDFs -> ${chunks.length} ZIP(s)`);

  for (let i = 0; i < chunks.length; i++) {
    const part = i + 1;
    const total = chunks.length;

    const zipName = total === 1 
      ? `facturas_${DAY_FOLDER}.zip`
      : `facturas_${DAY_FOLDER}_part${part}of${total}.zip`;
    
    const zipPath = path.join(ZIPS_DIR, zipName);
    await zipFiles(chunks[i], zipPath);
    console.log("ZIP creado:", zipPath);

    // Validación final del ZIP (Gmail)
    const st = await fsp.stat(zipPath);
    const mb = st.size / (1024 * 1024);

    if (mb > 24.5) {
      console.warn(
        `ZIP aún demasiado grande (~${mb.toFixed(2)} MB): ${zipPath}. Baja MAX_ZIP_MB.`
      );
      continue;
    }

    await sendZipByEmail(gmail, { 
      to: TO_EMAIL, 
      date: todayDate,
      zipPath, 
      empresasCount: companiesWithDownloads.size 
    });

    const partInfo = total > 1 ? ` (parte ${part}/${total})` : '';
    console.log(`Email enviado: Facturas del ${todayDate}${partInfo} -> ${TO_EMAIL}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
