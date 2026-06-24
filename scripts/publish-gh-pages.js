const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEPLOY_DIR = path.resolve(process.env.HKICPA_DEPLOY_DIR || path.join(PROJECT_ROOT, "dist"));
const BRANCH_NAME = String(process.env.HKICPA_GH_PAGES_BRANCH || "gh-pages").trim();
const WORKTREE_DIR = path.resolve(process.env.HKICPA_GH_PAGES_WORKTREE || path.join(PROJECT_ROOT, ".gh-pages"));
const COMMIT_MESSAGE = String(
  process.env.HKICPA_GH_PAGES_COMMIT_MESSAGE || "chore: publish static site update",
).trim();
const DRY_RUN = process.env.HKICPA_GH_PAGES_DRY_RUN === "1";

function run(command, args, options = {}) {
  const cwd = options.cwd || PROJECT_ROOT;
  const safeArg = path.resolve(cwd);
  const safeArgs = safeArg ? ["-c", `safe.directory=${safeArg}`] : [];
  execFileSync(command, [...safeArgs, ...args], {
    stdio: "inherit",
    cwd,
    encoding: "utf8",
    env: options.env,
  });
}

function runCapture(command, args, options = {}) {
  const cwd = options.cwd || PROJECT_ROOT;
  const safeArg = path.resolve(cwd);
  const safeArgs = safeArg ? ["-c", `safe.directory=${safeArg}`] : [];
  return execFileSync(command, [...safeArgs, ...args], {
    cwd,
    encoding: "utf8",
  }).toString();
}

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${path.relative(PROJECT_ROOT, filePath)}`);
  }
}

function ensureDirectoryExists(target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
}

function cleanupDirectoryExceptGit(targetDir) {
  if (!fs.existsSync(targetDir)) {
    return;
  }

  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    if (entry.name === ".git") {
      continue;
    }

    const full = path.join(targetDir, entry.name);
    fs.rmSync(full, { recursive: true, force: true });
  }
}

function copyDirRecursive(source, target) {
  ensureDirectoryExists(target);
  fs.cpSync(source, target, { recursive: true });
}

function branchExists(branchName, options = {}) {
  try {
    runCapture("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], options);
    return true;
  } catch {
    return false;
  }
}

function remoteBranchExists(branchName, options = {}) {
  try {
    runCapture("git", ["ls-remote", "--exit-code", "--heads", "origin", branchName], options);
    return true;
  } catch {
    return false;
  }
}

function ensureWorktree() {
  ensureDirectoryExists(path.dirname(WORKTREE_DIR));

  if (fs.existsSync(path.join(WORKTREE_DIR, ".git"))) {
    if (!branchExists(BRANCH_NAME, { cwd: WORKTREE_DIR })) {
      throw new Error(`worktree exists at ${WORKTREE_DIR} but branch ${BRANCH_NAME} is missing`);
    }
    return;
  }

  const args = ["worktree", "add", "-B", BRANCH_NAME, WORKTREE_DIR];
  if (remoteBranchExists(`origin/${BRANCH_NAME}`, { cwd: PROJECT_ROOT })) {
    args.push(`origin/${BRANCH_NAME}`);
  }

  run("git", args, { cwd: PROJECT_ROOT });
}

function pushIfNeeded() {
  const branchRef = runCapture("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: WORKTREE_DIR }).trim();
  if (branchRef !== BRANCH_NAME) {
    throw new Error(`unexpected worktree branch ${branchRef}, expected ${BRANCH_NAME}`);
  }

  const status = runCapture("git", ["status", "--porcelain"], { cwd: WORKTREE_DIR }).trim();
  if (!status) {
    console.log("No changes to publish.");
    return false;
  }

  run("git", ["add", "-A"], { cwd: WORKTREE_DIR });
  if (DRY_RUN) {
    console.log(`[DRY_RUN] Skipping commit and push. Use HKICPA_GH_PAGES_DRY_RUN=0 to publish.`);
    return true;
  }
  run("git", ["commit", "-m", COMMIT_MESSAGE], { cwd: WORKTREE_DIR });
  syncRemoteBeforePush();
  run("git", ["push", "origin", `HEAD:${BRANCH_NAME}`], { cwd: WORKTREE_DIR });
  return true;
}

function remoteBranchExistsFromWorktree() {
  return remoteBranchExists(`origin/${BRANCH_NAME}`, { cwd: WORKTREE_DIR });
}

function syncRemoteBeforePush() {
  if (!remoteBranchExistsFromWorktree()) {
    return;
  }

  try {
    run("git", ["pull", "--ff-only", "origin", BRANCH_NAME], { cwd: WORKTREE_DIR });
  } catch {
    run("git", ["pull", "--no-edit", "-X", "ours", "origin", BRANCH_NAME], { cwd: WORKTREE_DIR });
  }
}

function main() {
  ensureFileExists(path.join(DEPLOY_DIR, "index.html"), "deploy package index.html");
  ensureFileExists(path.join(DEPLOY_DIR, "app.js"), "deploy package app.js");
  ensureFileExists(path.join(DEPLOY_DIR, "styles.css"), "deploy package styles.css");
  ensureFileExists(path.join(DEPLOY_DIR, "data", "resources.js"), "deploy package data/resources.js");

  ensureWorktree();
  cleanupDirectoryExceptGit(WORKTREE_DIR);
  copyDirRecursive(DEPLOY_DIR, WORKTREE_DIR);

  const updated = pushIfNeeded();
  if (!updated) {
    console.log(`Branch ${BRANCH_NAME} already up to date.`);
  }
}

main();
