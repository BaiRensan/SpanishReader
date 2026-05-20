const http = require("http");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const root = __dirname;
const articleFile = path.join(root, "articles.json");
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || "0.0.0.0";
const autoGitSync = process.env.AUTO_GIT_SYNC !== "0";
const execGit = promisify(execFile);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
let gitSyncTimer = null;
let gitSyncRunning = false;
let gitSyncQueued = false;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

async function git(args) {
  return execGit("git", args, {
    cwd: root,
    maxBuffer: 1024 * 1024,
  });
}

function scheduleGitSync() {
  if (!autoGitSync) return;

  clearTimeout(gitSyncTimer);
  gitSyncTimer = setTimeout(() => {
    syncArticlesToGitHub();
  }, 2500);
}

async function syncArticlesToGitHub() {
  if (gitSyncRunning) {
    gitSyncQueued = true;
    return;
  }

  gitSyncRunning = true;
  try {
    const status = await git(["status", "--porcelain", "--", "articles.json"]);
    if (!status.stdout.trim()) {
      console.log("GitHub sync skipped: articles.json has no changes.");
      return;
    }

    await git(["add", "articles.json"]);
    await git(["commit", "-m", "Update reader articles"]);
    await git(["push"]);
    console.log("GitHub sync complete: articles.json pushed.");
  } catch (error) {
    const message = error.stderr || error.stdout || error.message;
    console.warn(`GitHub sync skipped: ${message.trim()}`);
  } finally {
    gitSyncRunning = false;
    if (gitSyncQueued) {
      gitSyncQueued = false;
      scheduleGitSync();
    }
  }
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 2_000_000) {
      throw new Error("Request body is too large");
    }
  }
  return JSON.parse(body);
}

function isArticleList(value) {
  return (
    Array.isArray(value) &&
    value.every((article) => {
      return (
        article &&
        typeof article.id === "string" &&
        typeof article.title === "string" &&
        typeof article.text === "string" &&
        Array.isArray(article.sentences)
      );
    })
  );
}

async function handleArticles(request, response) {
  if (request.method === "GET") {
    try {
      const data = await readFile(articleFile, "utf8");
      send(response, 200, data, "application/json; charset=utf-8");
    } catch {
      send(response, 200, "[]", "application/json; charset=utf-8");
    }
    return;
  }

  if (request.method === "PUT") {
    try {
      const articles = await readJsonBody(request);
      if (!isArticleList(articles)) {
        send(response, 400, JSON.stringify({ error: "Invalid article data" }), "application/json; charset=utf-8");
        return;
      }

      await writeFile(articleFile, `${JSON.stringify(articles, null, 2)}\n`, "utf8");
      scheduleGitSync();
      send(response, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
    } catch {
      send(response, 400, JSON.stringify({ error: "Could not save articles" }), "application/json; charset=utf-8");
    }
    return;
  }

  send(response, 405, "Method not allowed");
}

async function handleStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(root, pathname));

  if (!filePath.startsWith(root)) {
    send(response, 403, "Forbidden");
    return;
  }

  try {
    const data = await readFile(filePath);
    const contentType = mimeTypes[path.extname(filePath)] ?? "application/octet-stream";
    send(response, 200, data, contentType);
  } catch {
    send(response, 404, "Not found");
  }
}

const server = http.createServer((request, response) => {
  if (request.url && request.url.startsWith("/api/articles")) {
    handleArticles(request, response);
    return;
  }

  handleStatic(request, response);
});

server.listen(port, host, () => {
  console.log(`Spanish Reader running at http://localhost:${port}`);
  console.log(`On your phone, try http://<your-computer-ip>:${port}`);
});
