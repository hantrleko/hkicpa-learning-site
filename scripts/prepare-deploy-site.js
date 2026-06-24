const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(PROJECT_ROOT, "data", "resources.js");
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, "dist");
const OUTPUT_DIR = path.resolve(process.env.HKICPA_DEPLOY_DIR || DEFAULT_OUTPUT);
const DEFAULT_SOURCE_ROOT = path.resolve("F:\\hkicpa LP+Past paper");
const SOURCE_ROOT = path.resolve(process.env.HKICPA_SOURCE_ROOT || DEFAULT_SOURCE_ROOT);
const PUBLIC_ROOT = String(process.env.HKICPA_PUBLIC_ROOT || "").trim();
const DEPLOY_PAPERS_DIR = String(process.env.HKICPA_DEPLOY_PAPERS || "").trim();
const STATIC_FILES = ["index.html", "app.js", "styles.css"];
const DATA_FILES = [path.join("data", "resources.js")];
const ALLOWED_EXTS = new Set([".pdf", ".doc", ".docx"]);

function toPosix(value) {
  return String(value || "").replace(/\\+/g, "/");
}

function parsePublicMount() {
  const trimmed = PUBLIC_ROOT.trim();

  if (!trimmed) {
    return DEPLOY_PAPERS_DIR ? toPosix(DEPLOY_PAPERS_DIR) : "hkicpa-papers";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const mount = parsed.pathname || "/";
      const normalized = toPosix(mount).replace(/\/+$/, "");
      return normalized === "/" || !normalized ? "hkicpa-papers" : normalized.replace(/^\//, "");
    } catch {
      return DEPLOY_PAPERS_DIR ? toPosix(DEPLOY_PAPERS_DIR) : "hkicpa-papers";
    }
  }

  if (trimmed.startsWith("/")) {
    return toPosix(trimmed).replace(/\/+$/, "").replace(/^\//, "");
  }

  return toPosix(trimmed).replace(/\/+$/, "");
}

function ensureDir(target) {
  if (!target) {
    return;
  }
  fs.mkdirSync(target, { recursive: true });
}

function copyFile(source, target) {
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
}

function copyDirRecursive(sourceRoot, outputRoot) {
  const stack = [sourceRoot];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(current, entry.name);
      const relative = path.relative(sourceRoot, sourcePath);
      const targetPath = path.join(outputRoot, relative);

      if (entry.isDirectory()) {
        ensureDir(targetPath);
        stack.push(sourcePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) {
        continue;
      }

      copyFile(sourcePath, targetPath);
    }
  }
}

function copyStaticOutput() {
  for (const fileName of [...STATIC_FILES, ...DATA_FILES]) {
    const source = path.join(PROJECT_ROOT, fileName);
    const target = path.join(OUTPUT_DIR, fileName);
    if (!fs.existsSync(source)) {
      continue;
    }
    copyFile(source, target);
  }
}

function assertResourcesReady() {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(
      "Missing data/resources.js. Please run npm run build first, for example:\n"
      + "  HKICPA_PUBLIC_ROOT=https://your-domain.com/hkicpa-papers npm run build",
    );
  }
}

function collectPaperSources() {
  const sourcePaths = new Set();

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("};");
    const dataJson = start >= 0 && end >= 0 ? raw.slice(start, end + 1) : "";
    const payload = dataJson ? JSON.parse(dataJson) : null;
    if (!payload || !Array.isArray(payload.resources)) {
      return sourcePaths;
    }

    for (const resource of payload.resources) {
      const absolute = String(resource.path || "").replace(/\\\\/g, "/");
      if (!absolute || !absolute.startsWith(SOURCE_ROOT.replace(/\\/g, "/"))) {
        continue;
      }
      sourcePaths.add(absolute);
    }
  } catch {
    // if parse fails, fallback to directory copy
  }

  return sourcePaths;
}

function copySourceMaterials() {
  const publicMount = parsePublicMount();
  const targetRoot = path.join(OUTPUT_DIR, publicMount);

  ensureDir(targetRoot);

  const resourcesFiles = collectPaperSources();
  if (resourcesFiles.size > 0) {
    for (const absolute of resourcesFiles) {
      const sourcePath = path.resolve(absolute);
      if (!fs.existsSync(sourcePath)) {
        continue;
      }
      const relative = path.relative(SOURCE_ROOT, sourcePath).replace(/^\\+/g, "");
      const targetPath = path.join(targetRoot, relative);
      copyFile(sourcePath, targetPath);
    }
    return { total: resourcesFiles.size, mode: "resources-index" };
  }

  copyDirRecursive(SOURCE_ROOT, targetRoot);
  return { total: 0, mode: "directory-fallback" };
}

function main() {
  assertResourcesReady();
  ensureDir(OUTPUT_DIR);
  copyStaticOutput();
  const copied = copySourceMaterials();

  console.log(`Built deploy package at: ${OUTPUT_DIR}`);
  console.log(`Copied ${copied.total} index-mapped files into ${path.relative(PROJECT_ROOT, OUTPUT_DIR + path.sep + parsePublicMount())}`);
  console.log(`Paper publish mode: ${copied.mode}`);
}

main();
