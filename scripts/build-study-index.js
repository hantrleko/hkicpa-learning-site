const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");

const SOURCE_ROOT = "F:\\hkicpa LP+Past paper";
const OUTPUT_FILE = path.join(__dirname, "..", "data", "resources.js");
const CACHE_FILE = path.join(__dirname, "..", "data", ".build-cache.json");
const CACHE_VERSION = 3;
const ALLOWED_EXTS = new Set([".pdf", ".doc", ".docx"]);
const PUBLIC_ROOT = normalizePublicRoot(process.env.HKICPA_PUBLIC_ROOT || "");

const OCR_OPTIONS = {
  enabled: true,
  fileTextDensityThreshold: 0.08,
  minPageTextLengthForOCR: 120,
  minQuestionTextLengthToSkipOcr: 420,
  ocrScale: 2.0,
  ocrLanguage: "eng",
  usePdftoppmFirst: true,
  pdftoppmDpi: 180,
};

function normalizeBuildMode(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "fast") return "fast";
  if (value === "full" || value === "ocr") return "full";
  if (value === "balanced") return "balanced";
  return "balanced";
}

const BUILD_OPTIONS = {
  fileLimit: Number(process.env.HKICPA_MAX_FILES || "0") > 0 ? Number(process.env.HKICPA_MAX_FILES) : 0,
  disableOcr: process.env.HKICPA_DISABLE_OCR === "1",
  ocrMode: normalizeBuildMode(process.env.HKICPA_BUILD_MODE || "balanced"),
  incremental: process.env.HKICPA_INCREMENTAL === undefined ? true : process.env.HKICPA_INCREMENTAL === "1",
  forceRebuild: process.env.HKICPA_FORCE_REBUILD === "1",
  quietPdfWarnings: process.env.HKICPA_QUIET_PDF_WARNING === undefined ? true : process.env.HKICPA_QUIET_PDF_WARNING === "1",
  showProgress: process.env.HKICPA_SHOW_PROGRESS !== "0",
  forceOcrAll: process.env.HKICPA_FORCE_OCR_ALL === "1",
};
if (BUILD_OPTIONS.disableOcr || BUILD_OPTIONS.ocrMode === "fast") {
  OCR_OPTIONS.enabled = false;
}

const PDF_PARSE = loadDependency("pdf-parse");
const MAMMOTH = loadDependency("mammoth");
const TESSERACT = loadDependency("tesseract.js");
const CANVAS = loadDependency("canvas");

let pdfjsLibPromise = null;
let ocrWorkerPromise = null;
let pdftoppmBinaryPromise = null;

const execFileAsync = promisify(execFile);

function loadDependency(name) {
  try {
    return require(name);
  } catch {
    return null;
  }
}

function suppressPdfjsWarnings() {
  if (!BUILD_OPTIONS.quietPdfWarnings) {
    return;
  }
  const originalWarn = console.warn;
  const originalError = console.error;
  const hasSuppressedPattern = (...args) => {
    const text = String(args[0] || "");
    const tail = args
      .slice(1)
      .map((item) => String(item || ""))
      .join(" ");
    const combined = `${text} ${tail}`;
    return combined.includes("UnknownErrorException: Unable to load font data at:") || combined.includes("TT: undefined function");
  };
  console.warn = (...args) => {
    if (hasSuppressedPattern(...args)) {
      return;
    }
    originalWarn(...args);
  };
  console.error = (...args) => {
    if (hasSuppressedPattern(...args)) {
      return;
    }
    originalError(...args);
  };
}

function normalizePublicRoot(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\\+/g, "/").replace(/\/+$/, "");
}

function toPublicUrl(relativePath) {
  const relative = String(relativePath || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  if (!PUBLIC_ROOT) {
    return "";
  }
  if (PUBLIC_ROOT.startsWith("http://") || PUBLIC_ROOT.startsWith("https://")) {
    return `${PUBLIC_ROOT}/${relative}`;
  }
  if (PUBLIC_ROOT.startsWith("/")) {
    return `${PUBLIC_ROOT.replace(/\/+$/, "")}/${relative}`;
  }
  return `${PUBLIC_ROOT}/${relative}`;
}

function makeFileSignature(stat) {
  return `${Number(stat.size)}|${Number(stat.mtimeMs || stat.mtime.getTime())}`;
}

function loadBuildCache(sourceRoot) {
  const resolvedSourceRoot = path.resolve(sourceRoot);
  if (!BUILD_OPTIONS.incremental || BUILD_OPTIONS.forceRebuild) {
    return {
      version: CACHE_VERSION,
      generatedAt: "",
      root: resolvedSourceRoot,
      files: {},
    };
  }

  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.version === CACHE_VERSION &&
      parsed.root === path.resolve(sourceRoot)
    ) {
      return parsed;
    }
  } catch {
    // ignore broken/absent cache
  }

  return {
    version: CACHE_VERSION,
    generatedAt: "",
    root: resolvedSourceRoot,
    files: {},
  };
}

function saveBuildCache(cache) {
  if (!BUILD_OPTIONS.incremental) {
    return;
  }
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch {
    // ignore cache write failures
  }
}

function cloneShallowJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function toCacheKey(filePath) {
  return String(filePath || "").replace(/\\/g, "/");
}

function getRuntimeResourceId(sourceRoot, filePath, localResourceId) {
  if (PUBLIC_ROOT) {
    const relative = path.relative(sourceRoot, filePath).replace(/\\/g, "/");
    const publicUrl = toPublicUrl(relative);
    return publicUrl || localResourceId;
  }
  return localResourceId;
}

function rebaseQuestionIds(question, runtimeResourceId) {
  const id = String(question.id || "");
  const hashIndex = id.indexOf("#");
  const suffix = hashIndex >= 0 ? id.slice(hashIndex + 1) : "";
  return {
    ...question,
    resourceId: runtimeResourceId,
    id: suffix ? `${runtimeResourceId}#${suffix}` : runtimeResourceId,
  };
}

async function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const standardFontDataUrl = `${pathToFileURL(
        path.join(__dirname, "..", "node_modules", "pdfjs-dist", "standard_fonts"),
      ).href}/`;

      if (!pdfjsLib.GlobalWorkerOptions.standardFontDataUrl) {
        pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = standardFontDataUrl;
      }

      return pdfjsLib;
    })();
  }
  return pdfjsLibPromise;
}

function getStandardFontDataUrl() {
  return `${pathToFileURL(
    path.join(__dirname, "..", "node_modules", "pdfjs-dist", "standard_fonts"),
  ).href}/`;
}

async function resolvePdftoppmBinary() {
  if (pdftoppmBinaryPromise !== null) {
    return pdftoppmBinaryPromise;
  }

  pdftoppmBinaryPromise = (async () => {
    const command = process.platform === "win32" ? "where.exe" : "which";
    try {
      const { stdout } = await execFileAsync(command, ["pdftoppm"]);
      const line = String(stdout || "").split(/\r?\n/).find((item) => item.trim());
      return line ? line.trim() : "pdftoppm";
    } catch {
      return null;
    }
  })();

  return pdftoppmBinaryPromise;
}

async function extractTextByPdftoppm(filePath, pageNumber) {
  if (!filePath || !pageNumber) {
    return "";
  }

  const binary = await resolvePdftoppmBinary();
  if (!binary || !TESSERACT) {
    return "";
  }

  const dpi = Math.max(120, Math.round(OCR_OPTIONS.pdftoppmDpi || 180));
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "hkicpa-pdf-ocr-"));
  const outPrefix = path.join(tempDir, "page");
  const preferFileName = `page-${pageNumber}.png`;
  const preferZeroPaddedName = `page-${String(pageNumber).padStart(2, "0")}.png`;

  try {
    await execFileAsync(binary, [
      "-f",
      String(pageNumber),
      "-l",
      String(pageNumber),
      "-r",
      String(dpi),
      "-png",
      path.resolve(filePath),
      outPrefix,
    ]);

    const dirFiles = await fs.promises.readdir(tempDir);
    const explicitMatch = dirFiles.find((name) => name === preferFileName || name === preferZeroPaddedName);
    const fallbackMatch = dirFiles.find((name) => {
      const normalized = name.toLowerCase();
      return (
        normalized.startsWith("page-") &&
        normalized.endsWith(".png") &&
        Number.parseInt(normalized.replace("page-", "").replace(".png", ""), 10) === pageNumber
      );
    });
    const pngFile = explicitMatch || fallbackMatch || "";

    if (!pngFile) {
      return "";
    }

    const worker = await getOcrWorker();
    if (!worker) {
      return "";
    }

    const result = await worker.recognize(path.join(tempDir, pngFile), {
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: 6,
    });
    return normalizeText(result?.data?.text || "");
  } catch {
    return "";
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

async function getOcrWorker() {
  if (!OCR_OPTIONS.enabled || !TESSERACT) {
    return null;
  }
  if (ocrWorkerPromise) {
    return ocrWorkerPromise;
  }

  ocrWorkerPromise = (async () => {
    const opts = {};
    const customLangPath = process.env.HKICPA_OCR_LANG_PATH;
    if (customLangPath) {
      opts.langPath = customLangPath;
    }
    const worker = await TESSERACT.createWorker(OCR_OPTIONS.ocrLanguage, 1, opts);
    return worker;
  })();

  return ocrWorkerPromise;
}

async function terminateOcrWorker() {
  if (!ocrWorkerPromise) {
    return;
  }

  try {
    const worker = await ocrWorkerPromise;
    await worker.terminate();
  } catch {
    // 忽略 OCR 清理失败，避免影响构建主流程
  } finally {
    ocrWorkerPromise = null;
  }
}

function collectFiles(root) {
  const items = [];
  const queue = [root];

  while (queue.length) {
    const current = queue.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(resolved);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (ALLOWED_EXTS.has(ext)) {
        items.push(resolved);
      }
    }
  }

  return items;
}

function normalizeModule(rawModule, category) {
  const moduleText = String(rawModule || "").trim().toUpperCase();
  if (!moduleText || moduleText === "UNKNOWN") {
    return "Unknown";
  }
  if (/^\d+$/.test(moduleText)) return `M${moduleText}`;
  if (/^\d+[A-Z]?$/.test(moduleText)) return `M${moduleText}`;
  if (/^M\d+[A-Z]?$/.test(moduleText)) return moduleText;
  if (/^[A-Z]$/.test(moduleText) && category === "11-14") return `M11${moduleText}`;
  return moduleText.startsWith("M") ? moduleText : `M${moduleText}`;
}

function isValidModuleToken(value) {
  return Boolean(value && /^\d+[A-Z]?$/.test(value));
}

function detectFromText(text) {
  const cleaned = String(text || "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();

  const candidates = [
    /\bmod(?:ule)?\s*([A-Z])\b/i,
    /\bM(\d{1,2}[A-Z]?)\b/i,
    /\bmodule\s*([0-9]{1,2}[A-Z]?)/i,
    /\bmod(?:ule)?\s*([0-9]{1,2}[A-Z]?)/i,
    /\bm(\d{1,2})(?=[^0-9]|$)/i,
  ];

  for (const rule of candidates) {
    const match = cleaned.match(rule);
    if (!match) {
      continue;
    }

    const hit = match[1]?.toUpperCase();
    if (!hit) {
      continue;
    }
    if (isValidModuleToken(hit) || /^[A-Z]$/.test(hit)) {
      return hit;
    }
  }

  const fallback = cleaned.match(/\bMod([A-Za-z])\b/i);
  if (fallback?.[1]) {
    return fallback[1].toUpperCase();
  }
  return "";
}

function detectModuleFromSegments(segments, category) {
  const cleaned = segments
    .map((segment) => String(segment || "").replace(/[^a-zA-Z0-9]+/g, " ").trim())
    .filter(Boolean);

  for (const segment of cleaned) {
    if (/^M\d+-\d+/i.test(segment) || /^\d+-\d+/i.test(segment)) {
      continue;
    }
    if (/^\d+-\d+$/.test(segment)) {
      continue;
    }

    let m = segment.match(/\bM(\d{1,2}[A-Z]?)\b/i);
    if (m?.[1]) return m[1].toUpperCase();
    m = segment.match(/\bmodule\s*([0-9]{1,2}[A-Z]?)/i);
    if (m?.[1]) return m[1].toUpperCase();
    m = segment.match(/\bmod(?:ule)?\s*([0-9]{1,2})\b/i);
    if (m?.[1]) return m[1].toUpperCase();
    m = segment.match(/\bmod(?:ule)?\s*([A-Z])\b/i);
    if (m?.[1]) return m[1].toUpperCase();
    m = segment.match(/\bm(\d{1,2})(?=[^0-9]|$)/i);
    if (m?.[1]) return m[1].toUpperCase();
  }

  if (category === "11-14" && /11past[- ]?paper/i.test(cleaned.join(" "))) {
    return "11";
  }
  return "";
}

function detectCategory(categoryPath) {
  const text = categoryPath.toLowerCase();
  if (text.includes("11-14lp+past paper")) return "11-14";
  if (text.includes("m1-10lp+past paper")) return "1-10";
  return "Other";
}

function detectType(name) {
  if (/(report|panelists)/i.test(name)) return "Report";
  if (/(errata|syllabus|rubric|rubrics|workshop|important note|detailed|proficiency)/i.test(name)) return "LP";
  if (/\banswer\b/i.test(name)) return "Answer";
  if (/\bquestion\b/i.test(name)) return "Question";
  return "Document";
}

function detectPeriod(name) {
  const match = name.match(
    /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|december|june|july))[ -]?(?:20\d{2}|19\d{2})?\b/i,
  );
  if (!match) return "Unspecified";
  return match[0].toUpperCase().replace(/\s+/g, " ").trim();
}

function detectYear(name) {
  const match = name.match(/(20\d{2}|19\d{2})/);
  return match ? Number(match[1]) : 0;
}

function detectSession(name) {
  if (/dec|december/i.test(name)) return "Dec";
  if (/jun|june/i.test(name)) return "Jun";
  if (/jan|january/i.test(name)) return "Jan";
  if (/feb|february/i.test(name)) return "Feb";
  if (/mar|march/i.test(name)) return "Mar";
  if (/apr|april/i.test(name)) return "Apr";
  if (/\bmay\b/i.test(name)) return "May";
  if (/jul|july/i.test(name)) return "Jul";
  if (/aug|august/i.test(name)) return "Aug";
  if (/sep|sept|september/i.test(name)) return "Sep";
  if (/oct|october/i.test(name)) return "Oct";
  if (/nov|november/i.test(name)) return "Nov";
  return "";
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/\f/g, "\n")
    .replace(/\u00ad/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeForMatch(text) {
  return String(text || "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function isOptionLine(line) {
  return (
    /^\s*[A-Z]\s*[\.\)\:]\s+/.test(line) ||
    /^\s*[A-Z][\)\.]\s+/.test(line) ||
    /^\s*\([A-Z]\)\s+/.test(line) ||
    /^\s*[a-z]\)\s+/.test(line) ||
    /^\s*\([a-z]\)\s+/.test(line) ||
    /^\s*\(\d+\)\s+/.test(line) ||
    /^\s*\d+[\.\)]\s+/.test(line)
  );
}

function isAnswerLine(line) {
  return /^\s*(?:answer|ans|参考答案|答案)\b/i.test(line);
}

function isLikelyQuestionHeader(line, header, nextLine) {
  const raw = String(line || "").replace(/[\u00a0\t]+/g, " ").trim();

  if (!raw) {
    return false;
  }

  if (/^\(?[A-Za-z]\)?[\)\.\:]\s+/.test(raw)) {
    return false;
  }

  if (/^\(?\d+\)?[\.\)]?\s*$/.test(raw)) {
    return false;
  }

  if (/^\(?\d+\)?\s+[A-Za-z]$/.test(raw)) {
    return false;
  }

  if (/第\s*\d+\s*(?:题|問|題)/i.test(raw)) {
    return true;
  }

  if (/\b(?:question|q\.*)\b/i.test(raw) && /^\s*(?:Question|Q|question|q)/i.test(raw)) {
    return true;
  }

  if (/Q\s*No\.?/i.test(raw)) {
    return true;
  }

  if (header?.title) {
    if (header.title.length >= 16) {
      return true;
    }

    const titleWithKeyword = /(\bmarks?|points?|required|请|解答|回答|choose|select|prepare|state|explain|calculate|analyse|analyze|discuss|identify|draw|evaluate|find|which|what|how|show)\b/i;
    if (titleWithKeyword.test(header.title)) {
      return true;
    }
  }

  if (/\b(\d{1,4})[\.\)][^\w]/.test(raw)) {
    const next = String(nextLine || "").replace(/[\u00a0\t]+/g, " ").trim();
    return (raw.length >= 20 && /(\bmarks?|required|请|回答|explain|prepare|state|discuss|identify|calculate|show|find|which|what|how|provide)\b/i.test(next)) || raw.length >= 32;
  }

  return false;
}

function isLooseQuestionHeaderCandidate(line, nextLine) {
  const raw = String(line || "").replace(/[\u00a0\t]+/g, " ").trim();
  if (!raw || /^\(?[A-Za-z]\)?[\)\.\:]\s+/.test(raw)) {
    return false;
  }

  if (/第\s*\d+\s*(?:题|題|問)/i.test(raw)) {
    return true;
  }

  if (/^\s*(?:Question|Q)\s*No\.?\s*\d+/i.test(raw)) {
    return true;
  }

  if (/^\s*(?:Question|Q)\s*\d+/i.test(raw)) {
    return true;
  }

  if (/^\s*\d+[\.\)]\s+/.test(raw) && raw.length > 26) {
    return true;
  }

  if (/\b(Section|SECTION|PART|Part)\b/.test(raw) && /Question/i.test(nextLine || "")) {
    return true;
  }

  return false;
}

function parseQuestionHeader(line) {
  const patterns = [
    /^\s*(?:question|q)\s*(\d{1,4})\s*[\.\:\)\-]?\s*(.*)$/i,
    /^\s*(\d{1,4})\s*[\.\)\]\-]\s*(.*)$/,
    /^\s*第\s*(\d{1,4})\s*题\b\s*(.*)$/,
    /^\s*第\s*(\d{1,4})\s*問\b\s*(.*)$/,
    /^\s*(?:Question|Q)\s*No\.?\s*(\d{1,4})\s*[:\-]?\s*(.*)$/i,
    /^\s*(?:Q|Question)\s*(\d{1,4})\s*[-–—]?\s*(.*)$/i,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (!match) {
      continue;
    }
    const number = match[1];
    if (!number) {
      continue;
    }
    return {
      number,
      title: String(match[2] || "").trim(),
      full: match[0],
    };
  }
  return null;
}

function hasQuestionHeader(text) {
  if (!text) {
    return false;
  }

  const lines = String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const nextLine = lines[i + 1] || "";
    const parsedHeader = parseQuestionHeader(line);
    if (parsedHeader && isLikelyQuestionHeader(line, parsedHeader, nextLine)) {
      return true;
    }
  }

  return lines.some((line, index) => {
    const nextLine = lines[index + 1] || "";
    return isLooseQuestionHeaderCandidate(line, nextLine);
  });
}

function extractFromBlockLines(lines) {
  const options = [];
  const promptLines = [];
  const rawLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    rawLines.push(trimmed);
    if (isAnswerLine(trimmed)) {
      continue;
    }
    if (isOptionLine(trimmed)) {
      const cleaned = trimmed.replace(/^\s*[A-Z]\s*[\.\)\:]\s*/, "").trim();
      options.push(cleaned || trimmed);
      continue;
    }
    promptLines.push(trimmed);
  }

  return {
    options,
    prompt: normalizeText(promptLines.join("\n")),
    full: normalizeText(rawLines.join("\n")),
  };
}

function splitByQuestionHeaders(normalizedText, allowLooseHeader = false) {
  const lines = String(normalizedText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks = [];
  let current = null;

  const pushCurrent = () => {
    if (!current || !current.lines.length) {
      return;
    }
    blocks.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const nextLine = lines[i + 1] || "";
    const header = parseQuestionHeader(line);
    const isHeader = header && isLikelyQuestionHeader(line, header, nextLine);
    const isLooseHeader = !isHeader && allowLooseHeader && isLooseQuestionHeaderCandidate(line, nextLine);

    if (isHeader || isLooseHeader) {
      pushCurrent();
      current = {
        header,
        lines: [line],
      };
      continue;
    }

    if (!current) {
      continue;
    }
    current.lines.push(line);
  }

  pushCurrent();
  return blocks;
}

function removeQuestionArtifacts(promptText) {
  return String(promptText || "")
    .replace(/^\s*Question\s*\d+\s*[\-–—:]?\s*/i, "")
    .replace(/^\s*第\s*\d+\s*题\b\s*/i, "")
    .replace(/^\s*第\s*\d+\s*問\b\s*/i, "")
    .trim();
}

function isQuestionRecordUsable(record) {
  const prompt = String(record.prompt || "").replace(/[\s\u00a0]+/g, "").trim();
  if (!prompt || prompt.length < 14) {
    return false;
  }

  const sourceText = String(record.prompt || "");
  if (/^\(?[A-Za-z]\)?[\)\.]\s+/.test(sourceText)) {
    return false;
  }

  return true;
}

function splitByParagraphFallback(normalizedText) {
  const blocks = [];
  const paragraphs = String(normalizedText || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) {
      continue;
    }
    blocks.push({
      header: null,
      lines,
    });
  }
  return blocks;
}

function buildQuestionRecord({
  rawBlock,
  numberPrefix,
  numberIndex,
  base,
  sourcePage,
  sourceMode,
}) {
  const parsed = extractFromBlockLines(rawBlock.lines);
  const parsedHeader = rawBlock.header || parseQuestionHeader(rawBlock.lines[0] || "");
    const numberRaw = numberPrefix || parsedHeader?.number || String(numberIndex).replace(/^0+/, "");
  const number = numberRaw ? numberRaw.replace(/^0+/, "") : String(numberIndex);

  const titleFromHeader = parsedHeader?.title || "";
  let prompt = parsed.prompt;
  const headerOnlyLine = parsedHeader ? normalizeText(parsedHeader.full) : "";

  if (titleFromHeader && prompt.startsWith(headerOnlyLine)) {
    prompt = prompt.substring(headerOnlyLine.length).trim();
  }
  if (!prompt && titleFromHeader) {
    prompt = normalizeText(titleFromHeader);
  }
  if (!prompt) {
    prompt = parsed.full;
  }
  if (titleFromHeader && titleFromHeader.length > 2 && titleFromHeader.length < 80 && !prompt.includes(titleFromHeader)) {
    prompt = `${titleFromHeader}\n${prompt}`.trim();
  }
  if (prompt.length < 10) {
    prompt = parsed.full;
  }
  if (!prompt) {
    return null;
  }

  if (!sourcePage) {
    return null;
  }

  const tidyPrompt = removeQuestionArtifacts(prompt);
  if (tidyPrompt) {
    prompt = tidyPrompt;
  }

  return {
    ...base,
    id: `${base.resourceId}#${base.kind.toLowerCase()}-${base.resourceKind || "q"}-p${String(sourcePage).padStart(3, "0")}-${numberIndex}`,
    number,
    prompt,
    full: parsed.full,
    options: parsed.options,
    sourcePage,
    sourceMode,
    ocrUsed: sourceMode === "ocr",
    sourceMatch: (parsed.full || parsed.prompt || "").slice(0, 180),
    previewAvailable: base.previewAvailable,
  };
}

function parseQuestionsFromText(rawText, base, sourcePage, sourceMode, kind) {
  const normalized = normalizeText(rawText);
  if (!normalized) {
    return [];
  }

  const blocksByHeader = splitByQuestionHeaders(normalized, false);
  const blocksByLooseHeader = blocksByHeader.length ? [] : splitByQuestionHeaders(normalized, true);
  const candidates = [];
  const sourceBlocks = blocksByHeader.length
    ? blocksByHeader
    : blocksByLooseHeader.length
      ? blocksByLooseHeader
      : splitByParagraphFallback(normalized);
  const baseObj = {
    ...base,
    kind,
    sourceMatch: "",
  };
  const seen = new Set();

  sourceBlocks.forEach((block, index) => {
    const numberPrefix = block.header?.number || "";
    const created = buildQuestionRecord({
      rawBlock: block,
      numberPrefix,
      numberIndex: index + 1,
      base: baseObj,
      sourcePage,
      sourceMode,
    });

    if (!created) {
      return;
    }

    if (!isQuestionRecordUsable(created)) {
      return;
    }

    const dedupeKey = `${created.sourcePage}|${created.number}|${normalizeForMatch(created.prompt).slice(0, 220)}`;
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);
    candidates.push(created);
  });

  return candidates;
}

function mergeQuestionCandidates(textCandidates, ocrCandidates) {
  const result = [...textCandidates];

  const isDuplicate = (existing, candidate) => {
    if (existing.sourcePage !== candidate.sourcePage) {
      return false;
    }
    if (existing.number && candidate.number && existing.number === candidate.number) {
      const a = normalizeForMatch(existing.prompt || existing.full || "");
      const b = normalizeForMatch(candidate.prompt || candidate.full || "");
      if (!a || !b) {
        return false;
      }
      return a.includes(b.slice(0, 120)) || b.includes(a.slice(0, 120));
    }
    return false;
  };

  for (const candidate of ocrCandidates) {
    const duplicate = result.find((existing) => isDuplicate(existing, candidate));
    if (!duplicate) {
      result.push(candidate);
      continue;
    }

    const existingPrompt = duplicate.prompt || "";
    const mergedPrompt = `${existingPrompt}\n${candidate.prompt}`.trim();
    duplicate.prompt = normalizeText(mergedPrompt);
    if (candidate.options?.length > duplicate.options.length) {
      duplicate.options = candidate.options;
    }
    duplicate.sourceMatch = (duplicate.sourceMatch || duplicate.prompt || "").slice(0, 180);
  }

  return result;
}

function dedupeQuestions(questions) {
  const seen = new Set();
  return questions.filter((item) => {
    const key = `${item.category}|${item.module}|${item.year || 0}|${item.session || "NA"}|${item.resourceId}|${item.number}|${item.sourcePage || 0}|${normalizeForMatch(item.prompt).slice(0, 160)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildAnswerMap(answers) {
  const map = new Map();
  for (const answer of answers) {
    const group = map.get(answer.groupKey) || new Map();
    const answerNo = answer.number || "";
    if (answerNo) {
      group.set(answerNo, answer.prompt || answer.full);
      map.set(answer.groupKey, group);
    }
  }
  return map;
}

function isLikelyLowQualityText(text) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return true;
  }
  if (normalized.length >= OCR_OPTIONS.minQuestionTextLengthToSkipOcr) {
    return false;
  }
  const alphaNum = (normalized.match(/[A-Za-z0-9\u4e00-\u9fa5]/g) || []).length;
  const alphaNumRatio = normalized.length ? alphaNum / normalized.length : 0;
  return alphaNumRatio < 0.5 || normalized.split(/\s+/).filter(Boolean).length < 10;
}

function shouldRunOcrForPage({
  pageText,
  forceOCRForAllPages,
  textCandidateCount,
}) {
  if (!OCR_OPTIONS.enabled) {
    return false;
  }
  if (BUILD_OPTIONS.forceOcrAll) {
    return true;
  }
  if (forceOCRForAllPages) {
    return true;
  }
  if (textCandidateCount > 0) {
    return false;
  }
  return isLikelyLowQualityText(pageText) || String(pageText).trim().length < OCR_OPTIONS.minPageTextLengthForOCR;
}

async function extractPageTextContent(pdfDoc, pageNumber) {
  const page = await pdfDoc.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const pageText = textContent.items.map((item) => item.str).join(" ");
  return normalizeText(pageText);
}

async function extractOcrFromPage(resourcePath, pageNumber, resourceId, pdfDoc) {
  if (!TESSERACT) {
    return "";
  }

  if (OCR_OPTIONS.usePdftoppmFirst) {
    try {
      const pdftoppmText = await extractTextByPdftoppm(resourcePath, pageNumber);
      if (pdftoppmText) {
        return pdftoppmText;
      }
    } catch (err) {
      console.warn(`OCR(pdftoppm) failed for ${resourceId} page ${pageNumber}: ${err.message}`);
    }
  }

  if (!CANVAS || !pdfDoc) {
    return "";
  }

  try {
    let canvas;
    const worker = await getOcrWorker();
    if (!worker) {
      return "";
    }

    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: OCR_OPTIONS.ocrScale });
    canvas = CANVAS.createCanvas(Math.max(1, Math.floor(viewport.width)), Math.max(1, Math.floor(viewport.height)));
    const ctx = canvas.getContext("2d");

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    const buffer = canvas.toBuffer("image/png");
    const result = await worker.recognize(buffer, {
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: 6,
    });
    const text = normalizeText(result?.data?.text || "");
    return text;
  } catch (err) {
    console.warn(`OCR failed for ${resourceId} page ${pageNumber}: ${err.message}`);
    return "";
  } finally {
    if (typeof canvas !== "undefined") {
      canvas.width = 1;
      canvas.height = 1;
    }
  }
}

async function parsePdfResource(resource, baseRecord, parseBase, questions, answers) {
  const filePath = resource.path;
  const sourceId = resource.id || pathToFileURL(filePath).href;
  const base = {
    ...parseBase,
  };

  const buffer = fs.readFileSync(filePath.replace("file:///", ""));
  const pdfBytes = new Uint8Array(buffer);
  let doc;
  let pages = [];
  let fullFromPdf = "";
  let fileOCRUsed = false;
  let fileOCRPages = 0;

  try {
    const pdfLib = await loadPdfJs();
    const loadingTask = pdfLib.getDocument({
      data: pdfBytes,
      standardFontDataUrl: getStandardFontDataUrl(),
      disableFontFace: true,
    });
    doc = await loadingTask.promise;
    const totalPages = doc.numPages || 0;
    pages = new Array(totalPages).fill(null);
    let textSum = 0;

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
      const pageNumber = pageIndex + 1;
      const pageText = await extractPageTextContent(doc, pageNumber);
      pages[pageIndex] = {
        pageNumber,
        text: pageText,
      };
      textSum += pageText.length;
      fullFromPdf = `${fullFromPdf}\n\n${pageText}`;
    }

    const hasHeader = hasQuestionHeader(fullFromPdf);
    const avgPageChars = totalPages ? textSum / totalPages : 0;
    const density = avgPageChars / 1200;
    const forceOCRForAllPages = !hasHeader || density < OCR_OPTIONS.fileTextDensityThreshold;

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const current = pages[pageIndex];
      const pageText = current.text || "";
      const textList = parseQuestionsFromText(pageText, base, current.pageNumber, "text", resource.kind);
      const needOcr = shouldRunOcrForPage({
        pageText,
        forceOCRForAllPages,
        textCandidateCount: textList.length,
      });

      let ocrText = "";
      if (needOcr) {
        ocrText = await extractOcrFromPage(filePath, current.pageNumber, sourceId, doc);
        if (ocrText) {
          fileOCRUsed = true;
          fileOCRPages += 1;
        }
      }

      const ocrList = ocrText ? parseQuestionsFromText(ocrText, base, current.pageNumber, "ocr", resource.kind) : [];
      const merged = ocrText ? mergeQuestionCandidates(textList, ocrList) : textList;
      const withSourcePage = merged.filter((item) => item.sourcePage >= 1);

      if (resource.kind === "Question") {
        questions.push(...withSourcePage);
      } else {
        answers.push(...withSourcePage);
      }
    }

    return {
      pageCount: totalPages,
      ocrApplied: fileOCRUsed,
      ocrPages: fileOCRPages,
    };
  } catch (err) {
    console.warn(`PDF parse failed: ${sourceId}`, err.message);
    return {
      pageCount: pages.length,
      ocrApplied: false,
      ocrPages: fileOCRPages,
    };
  } finally {
    if (doc && typeof doc.destroy === "function") {
      try {
        await doc.destroy();
      } catch {
        // ignore destroy failures
      }
    }
  }
}

async function parseTextResource(resource, parseBase, questions, answers) {
  const text = await extractTextFromFile(resource.path);
  if (!text) {
    return { pageCount: 1, ocrApplied: false };
  }
  const parsed = parseQuestionsFromText(text, parseBase, 1, "text", resource.kind);
  if (resource.kind === "Question") {
    questions.push(...parsed);
  } else {
    answers.push(...parsed);
  }
  return { pageCount: 1, ocrApplied: false };
}

async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf" && PDF_PARSE) {
    const buffer = fs.readFileSync(filePath);
    const parsed = await PDF_PARSE(buffer);
    return normalizeText(parsed && parsed.text ? parsed.text : "");
  }
  if (ext === ".docx" && MAMMOTH) {
    const result = await MAMMOTH.extractRawText({ path: filePath });
    return normalizeText(result && result.value ? result.value : "");
  }
  if (ext === ".doc" && PDF_PARSE) {
    return "";
  }
  return "";
}

function ensureQuestionSelectFields(questions) {
  return questions.map((item) => ({
    ...item,
    hasAnswer: Boolean(item.hasAnswer),
    sourceMode: item.sourceMode || "text",
    sourcePage: item.sourcePage || 1,
    sourceMatch: item.sourceMatch || "",
    previewAvailable: item.previewAvailable || false,
  }));
}

async function buildResourceRecords(sourceRoot) {
  const cache = loadBuildCache(sourceRoot);
  const activeCache = {
    version: CACHE_VERSION,
    generatedAt: new Date().toISOString(),
    root: path.resolve(sourceRoot),
    files: {},
  };
  const runtimeIdByLocal = new Map();
  const ocrModeTag = OCR_OPTIONS.enabled ? `ocr-${BUILD_OPTIONS.ocrMode}` : "ocr-off";

  const files = collectFiles(sourceRoot);
  const limitedFiles =
    BUILD_OPTIONS.fileLimit > 0
      ? files.slice(0, BUILD_OPTIONS.fileLimit)
      : files;
  const totalFiles = limitedFiles.length;
  const resources = [];
  const questionCandidates = [];
  const answerCandidates = [];
  const stats = {
    total: 0,
    cachedHit: 0,
    parsedFiles: 0,
    parsedPdfFiles: 0,
    ocrFileCount: 0,
    ocrPageCount: 0,
    skippedByMode: 0,
  };
  if (BUILD_OPTIONS.showProgress) {
    console.log(`开始扫描 ${totalFiles} 个候选文件（总计扫描到 ${files.length} 个）`);
  }

  for (let index = 0; index < limitedFiles.length; index += 1) {
    const absolutePath = limitedFiles[index];
    if (BUILD_OPTIONS.showProgress) {
      console.log(`[${index + 1}/${totalFiles}] 正在处理：${path.basename(absolutePath)}`);
    }
    const stat = fs.statSync(absolutePath);
    const relative = path.relative(sourceRoot, absolutePath).replace(/\\/g, "/");
    const normalized = absolutePath.replace(/\\/g, "/");
    const segments = relative.split("/").filter(Boolean);
    const fileName = path.basename(absolutePath);
    const stageRoot = segments.length > 0 ? segments[0] : "";
    const category = detectCategory(stageRoot);
    const pathText = segments.join(" ");
    const pathSegments = segments.slice(1, -1);
    const fullText = [relative, fileName].join(" ");
    const segmentModule = detectModuleFromSegments(pathSegments, category);
    const moduleFromPathText = detectFromText([pathSegments.join(" "), fileName].filter(Boolean).join(" "));
    const fromFileName = detectFromText(fileName);
    const baseNumeric = isValidModuleToken(segmentModule) ? segmentModule : "";

    let moduleHint = "";
    if (isValidModuleToken(moduleFromPathText) || /^[A-Z]$/.test(moduleFromPathText || "")) {
      moduleHint = moduleFromPathText;
    } else if (isValidModuleToken(fromFileName) || /^[A-Z]$/.test(fromFileName || "")) {
      moduleHint = fromFileName;
    }
    if (baseNumeric && moduleHint && /^[A-Z]$/.test(moduleHint)) {
      moduleHint = `${baseNumeric}${moduleHint}`;
    }
    if (!moduleHint) {
      moduleHint =
        isValidModuleToken(segmentModule) || /^[A-Z]$/.test(segmentModule || "")
          ? segmentModule
          : detectFromText(fullText);
    }

    let moduleId = normalizeModule(moduleHint, category);
    if (moduleId === "Unknown" && /11.*past/i.test(path.relative(SOURCE_ROOT, absolutePath))) {
      const letterMatch = fullText.match(/\bMod([A-Za-z])\b/i);
      if (letterMatch?.[1]) {
        moduleId = `M11${letterMatch[1].toUpperCase()}`;
      }
    }
    if (moduleId === "Unknown" && /11.*past/i.test(path.relative(SOURCE_ROOT, absolutePath))) {
      const fallback = detectFromText(pathSegments.join(" "));
      if (fallback) {
        moduleId = normalizeModule(fallback, category);
      }
    }

    const containsPastMarker = /\bpast paper\b/i.test(fullText);
    const isLpFile = /\bLP\b|learning|syllabus|rubric|workshop|notes|教材/i.test(fileName + pathText);
    const isPastPaper = containsPastMarker || /past/i.test(segments[0] || "");
    const recordType = detectType(fileName);
    const year = detectYear(fileName);
    const session = detectSession(fileName);
    const ext = path.extname(fileName).toLowerCase();
    const localFileUrl = pathToFileURL(absolutePath).href;
    const resourceId = localFileUrl;
    const isPdf = ext === ".pdf";
    const signature = makeFileSignature(stat);
    const cacheKey = toCacheKey(normalized);
    const cached = BUILD_OPTIONS.incremental ? cache.files?.[cacheKey] : null;
    const hasCachedPayload = Boolean(
      cached &&
      ((recordType === "Question" && Array.isArray(cached.questions)) ||
        (recordType === "Answer" && Array.isArray(cached.answers))),
    );
    const shouldReuseCache =
      BUILD_OPTIONS.incremental &&
      !BUILD_OPTIONS.forceRebuild &&
      hasCachedPayload &&
      cached &&
      cached.signature === signature &&
      cached.type === recordType &&
      cached.ext === ext &&
      (BUILD_OPTIONS.ocrMode === "fast" || cached.ocrMode === ocrModeTag);
    const runtimeId = getRuntimeResourceId(sourceRoot, normalized, localFileUrl);
    const runtimeForCurrentFile = runtimeId;

    const baseRecord = {
      id: runtimeId,
      path: normalized,
      name: fileName,
      category,
      module: moduleId,
      kind: isPastPaper && !isLpFile ? "Past Paper" : "LP Material",
      type: recordType,
      session,
      year,
      periodLabel: detectPeriod(fileName),
      lastModified: stat.mtime.toISOString(),
      sizeMB: Number((stat.size / (1024 * 1024)).toFixed(2)),
      ext,
      indexReady: true,
      pageCount: 1,
      ocrApplied: false,
      questionCount: 0,
      answerCount: 0,
      localPathUrl: localFileUrl,
      isRemote: Boolean(PUBLIC_ROOT),
    };
    runtimeIdByLocal.set(resourceId, runtimeForCurrentFile);
    runtimeIdByLocal.set(normalized, runtimeForCurrentFile);

    if (!["Question", "Answer"].includes(recordType)) {
      stats.total += 1;
      resources.push(baseRecord);
      activeCache.files[cacheKey] = {
        type: recordType,
        ext,
        signature,
        kind: baseRecord.kind,
        localPathUrl: localFileUrl,
        path: normalized,
        ocrMode: ocrModeTag,
        pageCount: baseRecord.pageCount,
        ocrApplied: baseRecord.ocrApplied,
        questionCount: baseRecord.questionCount,
        answerCount: baseRecord.answerCount,
      };
      continue;
    }

    if (shouldReuseCache) {
      stats.cachedHit += 1;
      stats.total += 1;
      baseRecord.pageCount = Number(cached.pageCount || 1);
      baseRecord.ocrApplied = Boolean(cached.ocrApplied);
      baseRecord.questionCount = Number(
        cached.questionCount || (cached.questions ? cached.questions.length : 0),
      );
      baseRecord.answerCount = Number(
        cached.answerCount || (cached.answers ? cached.answers.length : 0),
      );

      resources.push(baseRecord);
      if (recordType === "Question") {
        questionCandidates.push(...cloneShallowJson(cached.questions || []).map((q) => rebaseQuestionIds(q, runtimeForCurrentFile)));
      } else {
        answerCandidates.push(...cloneShallowJson(cached.answers || []).map((a) => rebaseQuestionIds(a, runtimeForCurrentFile)));
      }

      activeCache.files[cacheKey] = {
        ...cached,
        type: recordType,
        ext,
        signature,
        localPathUrl: localFileUrl,
        path: normalized,
        ocrMode: ocrModeTag,
        ocrApplied: baseRecord.ocrApplied,
        pageCount: baseRecord.pageCount,
        questionCount: baseRecord.questionCount,
        answerCount: baseRecord.answerCount,
      };
      continue;
    }

    if (ext === ".pdf" && !PDF_PARSE && !TESSERACT) {
      stats.total += 1;
      stats.skippedByMode += 1;
      resources.push(baseRecord);
      activeCache.files[cacheKey] = {
        type: recordType,
        ext,
        signature,
        kind: baseRecord.kind,
        localPathUrl: localFileUrl,
        path: normalized,
        ocrMode: ocrModeTag,
        pageCount: baseRecord.pageCount,
        ocrApplied: baseRecord.ocrApplied,
        questionCount: baseRecord.questionCount,
        answerCount: baseRecord.answerCount,
      };
      continue;
    }
    if (ext === ".docx" && !MAMMOTH) {
      stats.total += 1;
      stats.skippedByMode += 1;
      resources.push(baseRecord);
      activeCache.files[cacheKey] = {
        type: recordType,
        ext,
        signature,
        kind: baseRecord.kind,
        localPathUrl: localFileUrl,
        path: normalized,
        ocrMode: ocrModeTag,
        pageCount: baseRecord.pageCount,
        ocrApplied: baseRecord.ocrApplied,
        questionCount: baseRecord.questionCount,
        answerCount: baseRecord.answerCount,
      };
      continue;
    }

    const parseBase = {
      category,
      module: moduleId,
      year,
      session: session || "NA",
      resourceId,
      resourceName: fileName,
      resourcePath: normalized,
      previewAvailable: isPdf,
      groupKey: `${category}|${moduleId}|${year || 0}|${session || "NA"}`,
      resourceKind: recordType === "Question" ? "q" : "a",
    };
    const questionStart = questionCandidates.length;
    const answerStart = answerCandidates.length;

    if (ext === ".pdf") {
      stats.parsedFiles += 1;
      stats.parsedPdfFiles += 1;
      stats.total += 1;
      const report = await parsePdfResource(
        { kind: recordType, path: absolutePath, id: baseRecord.id },
        baseRecord,
        parseBase,
        questionCandidates,
        answerCandidates,
      );
      if (report.ocrApplied) {
        stats.ocrFileCount += 1;
      }
      stats.ocrPageCount += report.ocrPages || 0;
      baseRecord.pageCount = report.pageCount || 1;
      baseRecord.ocrApplied = report.ocrApplied || false;
      if (recordType === "Question") {
        baseRecord.questionCount = questionCandidates.filter((item) => item.resourceId === parseBase.resourceId).length;
        activeCache.files[cacheKey] = {
          type: recordType,
          ext,
          signature,
          kind: baseRecord.kind,
          localPathUrl: localFileUrl,
          path: normalized,
          ocrMode: ocrModeTag,
          pageCount: baseRecord.pageCount,
          ocrApplied: baseRecord.ocrApplied,
          questionCount: baseRecord.questionCount,
          answerCount: baseRecord.answerCount,
          questions: cloneShallowJson(
            questionCandidates.slice(questionStart).map((question) => rebaseQuestionIds(question, resourceId)),
          ),
        };
      } else {
        baseRecord.answerCount = answerCandidates.filter((item) => item.resourceId === parseBase.resourceId).length;
        activeCache.files[cacheKey] = {
          type: recordType,
          ext,
          signature,
          kind: baseRecord.kind,
          localPathUrl: localFileUrl,
          path: normalized,
          ocrMode: ocrModeTag,
          pageCount: baseRecord.pageCount,
          ocrApplied: baseRecord.ocrApplied,
          questionCount: baseRecord.questionCount,
          answerCount: baseRecord.answerCount,
          answers: cloneShallowJson(
            answerCandidates.slice(answerStart).map((answer) => rebaseQuestionIds(answer, resourceId)),
          ),
        };
      }
      resources.push(baseRecord);
      continue;
    }

    const text = await extractTextFromFile(absolutePath);
    if (!text) {
      stats.total += 1;
      stats.skippedByMode += 1;
      continue;
    }
    const parsed = parseQuestionsFromText(text, parseBase, 1, "text", recordType);
    if (recordType === "Question") {
      questionCandidates.push(...parsed);
      baseRecord.questionCount = parsed.length;
      activeCache.files[cacheKey] = {
        type: recordType,
        ext,
        signature,
        kind: baseRecord.kind,
        localPathUrl: localFileUrl,
        path: normalized,
        ocrMode: ocrModeTag,
        pageCount: baseRecord.pageCount,
        ocrApplied: baseRecord.ocrApplied,
        questionCount: baseRecord.questionCount,
        answerCount: baseRecord.answerCount,
        questions: cloneShallowJson(parsed.map((question) => rebaseQuestionIds(question, resourceId))),
      };
    } else {
      answerCandidates.push(...parsed);
      baseRecord.answerCount = parsed.length;
      activeCache.files[cacheKey] = {
        type: recordType,
        ext,
        signature,
        kind: baseRecord.kind,
        localPathUrl: localFileUrl,
        path: normalized,
        ocrMode: ocrModeTag,
        pageCount: baseRecord.pageCount,
        ocrApplied: baseRecord.ocrApplied,
        questionCount: baseRecord.questionCount,
        answerCount: baseRecord.answerCount,
        answers: cloneShallowJson(parsed.map((question) => rebaseQuestionIds(question, resourceId))),
      };
    }
    stats.parsedFiles += 1;
    stats.total += 1;
    resources.push(baseRecord);
  }

  const answerByGroup = buildAnswerMap(answerCandidates);
  const questionBank = dedupeQuestions(
    ensureQuestionSelectFields(
      questionCandidates.map((question) => {
        const groupAnswers = answerByGroup.get(question.groupKey);
        return {
          ...question,
          answer: groupAnswers && groupAnswers.get(question.number) ? groupAnswers.get(question.number) : "",
          answerSource: question.answerSource || "",
          hasAnswer: Boolean(groupAnswers && groupAnswers.get(question.number)),
        };
      }),
    ),
  );
  const remappedQuestions = questionBank.map((question) => {
    const runtimeResourceId = runtimeIdByLocal.get(question.resourceId) || getRuntimeResourceId(sourceRoot, question.resourcePath, question.resourceId);
    return rebaseQuestionIds(question, runtimeResourceId);
  });
  const remappedAnswers = answerCandidates.map((answer) => {
    const runtimeResourceId = runtimeIdByLocal.get(answer.resourceId) || getRuntimeResourceId(sourceRoot, answer.resourcePath, answer.resourceId);
    return rebaseQuestionIds(answer, runtimeResourceId);
  });

  for (const resource of resources) {
    const runtimeResourceId = runtimeIdByLocal.get(resource.id) || getRuntimeResourceId(sourceRoot, resource.path, resource.id);
    resource.id = runtimeResourceId;
    if (resource.type === "Question") {
      resource.questionCount = remappedQuestions.filter((q) => q.resourceId === resource.id).length;
      if (!resource.answerCount) {
        resource.answerCount = 0;
      }
    } else if (resource.type === "Answer") {
      resource.answerCount = remappedAnswers.filter((q) => q.resourceId === resource.id).length;
      resource.questionCount = remappedQuestions.filter((q) => q.groupKey === `${resource.category}|${resource.module}|${resource.year || 0}|${resource.session || "NA"}`).length;
    }
  }

  const sortedResources = resources.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    if (a.module !== b.module) {
      return a.module.localeCompare(b.module);
    }
    if (b.year !== a.year) return b.year - a.year;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });

  sortedResources.forEach((item, index) => {
    item.index = index;
  });

  return {
      resources: sortedResources,
      questions: remappedQuestions,
      generatedAt: new Date().toISOString(),
      root: sourceRoot,
      publicRoot: PUBLIC_ROOT || "",
      parserAvailable: !!(PDF_PARSE || MAMMOTH),
      cache: activeCache,
      stats,
    };
}

async function main() {
  try {
    suppressPdfjsWarnings();
    const modeLabel = BUILD_OPTIONS.ocrMode.toUpperCase();
    const scopeLabel = BUILD_OPTIONS.incremental ? "增量" : "非增量";
    const ocrLabel = OCR_OPTIONS.enabled ? "启用" : "关闭";
    console.log(`构建模式：${modeLabel} / OCR ${ocrLabel} / ${scopeLabel}`);
    const sourceRoot = process.env.HKICPA_SOURCE_ROOT || SOURCE_ROOT;
    const payload = await buildResourceRecords(sourceRoot);
    if (BUILD_OPTIONS.incremental && payload.cache) {
      saveBuildCache(payload.cache);
    }
    const output = {
      generatedAt: payload.generatedAt,
      root: payload.root,
      total: payload.resources.length,
      parserAvailable: payload.parserAvailable,
      resources: payload.resources,
      questions: payload.questions,
    };
    const text = `window.__HKICPA_STUDY_DATA__ = ${JSON.stringify(output, null, 2)};`;
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, text, "utf8");
    console.log(`Generated ${output.total} entries at: ${OUTPUT_FILE}`);
    console.log(`Extracted ${output.questions.length} questions from papers.`);
    const stats = payload.stats || {};
    const cacheLabel = `${stats.cachedHit || 0}/${stats.total || output.total || 0}`;
    console.log(`缓存复用: ${cacheLabel} 文件`);
    console.log(`重算文件: ${stats.parsedFiles || 0} 文件（其中 PDF ${stats.parsedPdfFiles || 0} 文件）`);
    console.log(`无解析路径命中: ${stats.skippedByMode || 0} 文件`);
    if ((stats.ocrFileCount || 0) > 0) {
      console.log(`OCR 执行: ${stats.ocrFileCount} 文件，${stats.ocrPageCount || 0} 页`);
    } else {
      console.log("OCR 执行: 0 文件, 0 页（本次走离线缓存/纯文本）");
    }
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  } finally {
    await terminateOcrWorker();
  }
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
