const { execFile } = require("child_process");
const { promisify } = require("util");

const exec = promisify(execFile);
const root = __dirname;
const message = process.argv.slice(2).join(" ") || "Update Spanish Reader";

async function git(args) {
  return exec("git", args, {
    cwd: root,
    maxBuffer: 1024 * 1024,
  });
}

async function main() {
  await git([
    "add",
    "index.html",
    "styles.css",
    "app.js",
    "articles.json",
    "server.js",
    "sync-to-github.js",
    "package.json",
    "README.md",
    ".gitignore",
  ]);

  const status = await git(["status", "--porcelain"]);
  if (!status.stdout.trim()) {
    console.log("Nothing to sync.");
    return;
  }

  await git(["commit", "-m", message]);
  await git(["push"]);
  console.log("Synced to GitHub.");
}

main().catch((error) => {
  const message = error.stderr || error.stdout || error.message;
  console.error(message.trim());
  process.exit(1);
});
