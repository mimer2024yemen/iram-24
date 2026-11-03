// Keeps the news JSON on its own "data" branch so the bot never writes to
// main. Writing main every few minutes made the Lovable ⇄ GitHub sync diverge
// and silently drop project changes. Only used inside GitHub Actions.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const WORKTREE = ".data-branch";

function git(args, cwd = ".") {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180000 }).trim();
}

/** Returns the directory that contains data/ on the data branch. */
export function prepareDataBranch(branch) {
  const wt = resolve(WORKTREE);
  if (existsSync(join(wt, ".git"))) {
    try { git(["pull", "--rebase", "-q", "origin", branch], wt); } catch { /* keep local copy */ }
    return wt;
  }
  const remote = git(["ls-remote", "--heads", "origin", branch]);
  if (remote) {
    git(["fetch", "-q", "--depth=1", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
    git(["worktree", "add", "-f", "-B", branch, wt, `origin/${branch}`]);
    return wt;
  }
  // First run: seed the branch with the data/ snapshot currently on main.
  git(["worktree", "add", "-f", "--detach", wt, "HEAD"]);
  git(["checkout", "-q", "--orphan", branch], wt);
  git(["rm", "-rfq", "--cached", "."], wt);
  for (const name of readdirSync(wt)) {
    if (name !== ".git" && name !== "data") rmSync(join(wt, name), { recursive: true, force: true });
  }
  git(["add", "-A", "data"], wt);
  git(["commit", "-qm", "data: seed from main"], wt);
  git(["push", "-q", "-u", "origin", branch], wt);
  return wt;
}

/** Commits and pushes whatever changed under data/ on the data branch. */
export function publishDataBranch(branch, wt) {
  git(["add", "-A", "data"], wt);
  try {
    git(["diff", "--cached", "--quiet"], wt);
    return false; // nothing changed
  } catch { /* has changes */ }
  git(["commit", "-qm", `news: ${new Date().toISOString().replace(/\.\d+Z$/, "Z")}`], wt);
  for (let i = 0; i < 3; i++) {
    try {
      git(["push", "-q", "origin", `HEAD:${branch}`], wt);
      return true;
    } catch {
      try { git(["pull", "--rebase", "-q", "origin", branch], wt); } catch { /* retry */ }
    }
  }
  throw new Error("data branch push failed (will retry next cycle)");
}
