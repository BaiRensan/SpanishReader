# Spanish Reader

本地编辑时运行：

```bash
node server.js
```

然后打开：

```text
http://localhost:4173
```

本机编辑会自动写入 `articles.json`。想分享给朋友时，把这些文件发布到任意静态网站托管服务即可：

- `index.html`
- `styles.css`
- `app.js`
- `articles.json`

朋友打开公网链接后会看到 `articles.json` 里的同一批文章。公网静态版本默认只读；他们在网页里修改的内容只会保存在他们自己的浏览器里，不会改你的 `articles.json`。

## 手机上远程查看

推荐方式：发布成静态网站。

1. 准备这四个文件：`index.html`、`styles.css`、`app.js`、`articles.json`。
2. 上传到 Cloudflare Pages、Netlify、GitHub Pages 或任意静态网站托管服务。
3. 托管服务会给你一个 `https://...` 链接。
4. 用手机打开这个链接，就能看到和 `articles.json` 一样的文章内容。

更新文章时：

1. 在电脑上打开 `http://localhost:4173`。
2. 修改文章并点击“保存并切句”，确认内容写入 `articles.json`。
3. 重新上传这四个文件，或者重新部署网站。
4. 手机刷新公网链接即可看到新内容。

注意：公网静态版本适合阅读和朗读。手机上修改的内容只会保存在手机浏览器里，不会自动写回你电脑上的 `articles.json`。

## 自动同步到 GitHub

推荐部署链路：

1. 把这个目录初始化为 Git 仓库，并推到 GitHub。
2. 在 Cloudflare Pages、Netlify 或 GitHub Pages 里连接这个 GitHub 仓库。
3. 本地运行 `node server.js`。
4. 在网页里保存文章后，服务端会自动提交并推送 `articles.json`。
5. 托管服务检测到 GitHub 更新后自动重新部署，手机刷新公网链接即可看到新文章。

首次绑定 GitHub 仓库：

```bash
git init
git branch -M main
git remote add origin git@github.com:你的用户名/你的仓库名.git
node sync-to-github.js "Initial Spanish Reader"
```

平时同步代码改动：

```bash
node sync-to-github.js "Update reader"
```

平时只更新文章：

```bash
node server.js
```

然后在网页里保存文章即可。自动同步默认开启；如果只想本地保存、不推 GitHub，可以这样启动：

```bash
AUTO_GIT_SYNC=0 node server.js
```
