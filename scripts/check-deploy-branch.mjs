// Stops `npm run deploy` unless this is a clean checkout of master: only merged, reviewed code goes live.
import { execFileSync } from "node:child_process";

const DEPLOY_BRANCH = "master";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== DEPLOY_BRANCH) {
  console.error(`Deploy stopped: you are on "${branch}". Merge the PR, then deploy from ${DEPLOY_BRANCH}.`);
  process.exit(1);
}
if (git("status", "--porcelain")) {
  console.error("Deploy stopped: there are uncommitted changes. Commit or stash them first.");
  process.exit(1);
}
console.log(`Deploying from ${DEPLOY_BRANCH} at ${git("rev-parse", "--short", "HEAD")}.`);
