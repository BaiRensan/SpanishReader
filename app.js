const storageKey = "spanish-reader-articles-v1";
const voiceStorageKey = "spanish-reader-voice-v1";
const themeStorageKey = "spanish-reader-theme-v1";
const apiArticlesEndpoint = "/api/articles";
const staticArticlesEndpoint = "articles.json";
const canUseServerSync =
  window.location.protocol !== "file:" &&
  ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

const sampleText = `Cuando era niña, mi abuela me contaba historias sobre el mar. Decía que cada ola traía una pregunta nueva y que había que escuchar con paciencia. Ahora vivo lejos de la costa, pero cuando estudio español, siento que esas historias vuelven poco a poco.`;

const defaultArticles = [
  {
    id: crypto.randomUUID(),
    title: "La memoria del mar",
    text: sampleText,
    sentences: [],
  },
];

const elements = {
  appShell: document.querySelector(".app-shell"),
  library: document.querySelector(".library"),
  themeToggle: document.querySelector("#themeToggle"),
  toggleLibrary: document.querySelector("#toggleLibrary"),
  articleList: document.querySelector("#articleList"),
  newArticle: document.querySelector("#newArticle"),
  deleteArticle: document.querySelector("#deleteArticle"),
  saveArticle: document.querySelector("#saveArticle"),
  articleTitle: document.querySelector("#articleTitle"),
  articleText: document.querySelector("#articleText"),
  sentenceList: document.querySelector("#sentenceList"),
  sentenceCount: document.querySelector("#sentenceCount"),
  readArticle: document.querySelector("#readArticle"),
  stopReading: document.querySelector("#stopReading"),
  voiceSelect: document.querySelector("#voiceSelect"),
  speechRate: document.querySelector("#speechRate"),
  rateValue: document.querySelector("#rateValue"),
  statusText: document.querySelector("#statusText"),
  template: document.querySelector("#sentenceTemplate"),
};

let articles = loadArticles();
let activeArticleId = articles[0]?.id;
let activeUtterance = null;
let preferredVoiceName = localStorage.getItem(voiceStorageKey) ?? "";
let preferredTheme = localStorage.getItem(themeStorageKey) ?? "light";
let saveTimer = null;

function applyTheme(theme) {
  preferredTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = preferredTheme;
  localStorage.setItem(themeStorageKey, preferredTheme);

  const isDark = preferredTheme === "dark";
  elements.themeToggle?.setAttribute("aria-label", isDark ? "切换浅色模式" : "切换深色模式");
  elements.themeToggle?.setAttribute("title", isDark ? "切换浅色模式" : "切换深色模式");
  const icon = elements.themeToggle?.querySelector("span");
  if (icon) icon.textContent = isDark ? "☀" : "☾";
}

function loadArticles() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return normalizeArticles(defaultArticles);
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? normalizeArticles(parsed) : normalizeArticles(defaultArticles);
  } catch {
    return normalizeArticles(defaultArticles);
  }
}

function normalizeArticles(input) {
  return input.map((article) => {
    const text = typeof article.text === "string" ? article.text : "";
    const existingSentences = Array.isArray(article.sentences) ? article.sentences : [];
    const translations = new Map(
      existingSentences.map((sentence) => [sentence.text, sentence.translation ?? ""]),
    );
    const sentences = splitSpanishSentences(text).map((sentenceText) => ({
      text: sentenceText,
      translation: translations.get(sentenceText) ?? "",
    }));

    return {
      id: article.id || crypto.randomUUID(),
      title: article.title || "未命名文章",
      text,
      sentences,
    };
  });
}

async function loadServerArticles() {
  if (window.location.protocol === "file:") return;

  try {
    const response = await fetchArticlesSource();

    const serverArticles = await response.json();
    if (!Array.isArray(serverArticles) || !serverArticles.length) return;

    articles = normalizeArticles(serverArticles);
    activeArticleId = articles[0].id;
    localStorage.setItem(storageKey, JSON.stringify(articles));
    render({ persist: false });
    setStatus(canUseServerSync ? "已从 articles.json 同步。" : "已加载分享文章。");
  } catch {
    setStatus("文章文件暂不可用，先使用浏览器本地保存。");
  }
}

async function fetchArticlesSource() {
  if (canUseServerSync) {
    const apiResponse = await fetch(apiArticlesEndpoint, { cache: "no-store" });
    if (apiResponse.ok) return apiResponse;
  }

  const staticResponse = await fetch(staticArticlesEndpoint, { cache: "no-store" });
  if (!staticResponse.ok) throw new Error("Could not load articles");
  return staticResponse;
}

function saveArticles() {
  localStorage.setItem(storageKey, JSON.stringify(articles));

  if (!canUseServerSync) return;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(syncArticlesToServer, 300);
}

async function syncArticlesToServer() {
  try {
    const response = await fetch(apiArticlesEndpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(articles),
    });

    if (!response.ok) throw new Error("Could not save articles");
    setStatus("已同步到 articles.json。");
  } catch {
    setStatus("同步到 articles.json 失败，已保存在浏览器。");
  }
}

function getActiveArticle() {
  return articles.find((article) => article.id === activeArticleId) ?? articles[0];
}

function splitSpanishSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .match(/[^.!?¿¡]+(?:[.!?]+|$)/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];
}

function renderArticleList() {
  elements.articleList.innerHTML = "";

  articles.forEach((article) => {
    const button = document.createElement("button");
    button.className = `article-item ${article.id === activeArticleId ? "active" : ""}`;
    button.type = "button";
    button.innerHTML = `<strong></strong><span></span>`;
    button.querySelector("strong").textContent = article.title || "未命名文章";
    button.querySelector("span").textContent = `${article.sentences.length} 句`;
    button.addEventListener("click", () => {
      persistCurrentInputs();
      activeArticleId = article.id;
      render();
    });
    elements.articleList.append(button);
  });
}

function renderEditor() {
  const article = getActiveArticle();
  elements.articleTitle.value = article?.title ?? "";
  elements.articleText.value = article?.text ?? "";
}

function renderSentences() {
  const article = getActiveArticle();
  const sentences = article?.sentences ?? [];
  elements.sentenceList.innerHTML = "";
  elements.sentenceCount.textContent = `${sentences.length} 句`;

  if (!sentences.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "粘贴文章后点击“保存并切句”，这里会出现逐句卡片。";
    elements.sentenceList.append(empty);
    return;
  }

  sentences.forEach((sentence, index) => {
    const node = elements.template.content.firstElementChild.cloneNode(true);
    node.dataset.index = String(index);
    node.querySelector(".spanish-text").textContent = sentence.text;

    const translation = sentence.translation?.trim();
    node.querySelector(".english-text").textContent = translation || "Translating...";
    node.addEventListener("click", () => speakSentence(index));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        speakSentence(index);
      }
    });
    elements.sentenceList.append(node);
  });
}

function render(options = {}) {
  const { persist = true } = options;
  renderArticleList();
  renderEditor();
  renderSentences();
  if (persist) saveArticles();
}

function persistCurrentInputs() {
  const article = getActiveArticle();
  if (!article) return;
  article.title = elements.articleTitle.value.trim() || "未命名文章";
  article.text = elements.articleText.value;
}

async function saveCurrentArticle() {
  const article = getActiveArticle();
  if (!article) return;

  const previousTranslations = new Map(
    article.sentences.map((sentence) => [sentence.text, sentence.translation ?? ""]),
  );

  article.title = elements.articleTitle.value.trim() || "未命名文章";
  article.text = elements.articleText.value.trim();
  article.sentences = splitSpanishSentences(article.text).map((text) => ({
    text,
    translation: previousTranslations.get(text) ?? "",
  }));

  setStatus(`已切分为 ${article.sentences.length} 句。`);
  render();
  await translateMissingSentences();
}

function setStatus(message) {
  elements.statusText.textContent = message;
}

function getAvailableSpanishVoices() {
  if (!("speechSynthesis" in window)) return [];

  return window.speechSynthesis
    .getVoices()
    .filter((voice) => {
      const lang = voice.lang?.toLowerCase() ?? "";
      const name = voice.name?.toLowerCase() ?? "";
      return lang.startsWith("es") || name.includes("spanish") || name.includes("español");
    })
    .sort((a, b) => scoreVoice(b) - scoreVoice(a));
}

function scoreVoice(voice) {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = 0;

  if (lang === "es-es") score += 35;
  if (lang.startsWith("es-")) score += 25;
  if (name.includes("google")) score += 35;
  if (name.includes("microsoft")) score += 32;
  if (name.includes("premium") || name.includes("enhanced")) score += 30;
  if (name.includes("monica") || name.includes("mónica")) score += 28;
  if (name.includes("paulina") || name.includes("marisol") || name.includes("jorge")) score += 24;
  if (voice.localService) score += 8;

  return score;
}

function populateVoiceOptions() {
  const voices = getAvailableSpanishVoices();
  elements.voiceSelect.innerHTML = "";

  if (!voices.length) {
    const option = new Option("浏览器默认西语", "");
    elements.voiceSelect.add(option);
    elements.voiceSelect.disabled = true;
    return;
  }

  elements.voiceSelect.disabled = false;
  voices.forEach((voice, index) => {
    const label = `${voice.name} (${voice.lang})`;
    const option = new Option(index === 0 ? `${label} · 推荐` : label, voice.name);
    elements.voiceSelect.add(option);
  });

  const savedVoice = voices.find((voice) => voice.name === preferredVoiceName);
  elements.voiceSelect.value = savedVoice?.name ?? voices[0].name;
  preferredVoiceName = elements.voiceSelect.value;
  localStorage.setItem(voiceStorageKey, preferredVoiceName);
}

function getSpanishVoice() {
  const voices = getAvailableSpanishVoices();
  return voices.find((voice) => voice.name === preferredVoiceName) ?? voices[0] ?? null;
}

function clearReadingState() {
  document.querySelectorAll(".sentence-card.reading").forEach((card) => {
    card.classList.remove("reading");
  });
}

function speak(text, onEnd) {
  if (!("speechSynthesis" in window)) {
    setStatus("当前浏览器不支持朗读。");
    return;
  }

  window.speechSynthesis.cancel();

  activeUtterance = new SpeechSynthesisUtterance(text);
  activeUtterance.lang = "es-ES";
  activeUtterance.rate = Number(elements.speechRate.value);
  activeUtterance.pitch = 1;
  activeUtterance.volume = 1;
  activeUtterance.voice = getSpanishVoice();
  activeUtterance.onend = () => {
    activeUtterance = null;
    clearReadingState();
    onEnd?.();
  };
  activeUtterance.onerror = () => {
    activeUtterance = null;
    clearReadingState();
    setStatus("朗读被中断。");
  };

  window.speechSynthesis.speak(activeUtterance);
}

function speakSentence(index) {
  const article = getActiveArticle();
  const sentence = article?.sentences[index];
  if (!sentence) return;

  const card = elements.sentenceList.querySelector(`[data-index="${index}"]`);
  clearReadingState();
  card?.classList.add("reading");
  setStatus(`正在朗读第 ${index + 1} 句。`);
  speak(sentence.text, () => setStatus("朗读完成。"));
}

function speakArticle() {
  const article = getActiveArticle();
  if (!article?.sentences.length) {
    setStatus("先保存并切句，再朗读全文。");
    return;
  }

  let index = 0;
  const readNext = () => {
    if (index >= article.sentences.length) {
      setStatus("全文朗读完成。");
      return;
    }

    clearReadingState();
    const card = elements.sentenceList.querySelector(`[data-index="${index}"]`);
    card?.classList.add("reading");
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    setStatus(`正在朗读第 ${index + 1}/${article.sentences.length} 句。`);

    const text = article.sentences[index].text;
    index += 1;
    speak(text, readNext);
  };

  readNext();
}

async function translateWithBrowserApi(text) {
  if (!("Translator" in window)) return null;

  const translator = await window.Translator.create({
    sourceLanguage: "es",
    targetLanguage: "en",
  });
  return translator.translate(text);
}

async function translateWithPublicApi(text) {
  const endpoint = new URL("https://api.mymemory.translated.net/get");
  endpoint.searchParams.set("q", text);
  endpoint.searchParams.set("langpair", "es|en");

  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("Translation request failed");

  const data = await response.json();
  return data?.responseData?.translatedText || "";
}

async function translateText(text) {
  const browserResult = await translateWithBrowserApi(text).catch(() => null);
  if (browserResult) return browserResult;
  return translateWithPublicApi(text);
}

async function translateSentence(index) {
  const article = getActiveArticle();
  const sentence = article?.sentences[index];
  if (!sentence) return;

  setStatus(`正在生成第 ${index + 1} 句英文对照...`);
  try {
    sentence.translation = await translateText(sentence.text);
    setStatus(`第 ${index + 1} 句英文对照已生成。`);
  } catch {
    sentence.translation = "English translation unavailable.";
    setStatus("自动英文对照暂时不可用。");
  }
}

async function translateMissingSentences() {
  const article = getActiveArticle();
  if (!article?.sentences.length) {
    return;
  }

  const missingCount = article.sentences.filter((sentence) => !sentence.translation?.trim()).length;
  if (!missingCount) return;

  elements.saveArticle.disabled = true;
  setStatus(`正在自动生成 ${missingCount} 句英文对照...`);
  for (let index = 0; index < article.sentences.length; index += 1) {
    if (!article.sentences[index].translation) {
      await translateSentence(index);
      renderSentences();
    }
  }
  elements.saveArticle.disabled = false;
  saveArticles();
  renderSentences();
  renderArticleList();
  setStatus("英文对照已自动生成。");
}

elements.toggleLibrary.addEventListener("click", () => {
  elements.library.classList.toggle("collapsed");
  elements.appShell.classList.toggle("library-collapsed");
});

elements.themeToggle.addEventListener("click", () => {
  applyTheme(preferredTheme === "dark" ? "light" : "dark");
});

elements.newArticle.addEventListener("click", () => {
  persistCurrentInputs();
  const article = {
    id: crypto.randomUUID(),
    title: "新文章",
    text: "",
    sentences: [],
  };
  articles.unshift(article);
  activeArticleId = article.id;
  render();
  elements.articleText.focus();
  setStatus("已创建新文章。");
});

elements.deleteArticle.addEventListener("click", () => {
  if (articles.length === 1) {
    articles[0] = {
      id: crypto.randomUUID(),
      title: "新文章",
      text: "",
      sentences: [],
    };
    activeArticleId = articles[0].id;
  } else {
    articles = articles.filter((article) => article.id !== activeArticleId);
    activeArticleId = articles[0].id;
  }
  window.speechSynthesis?.cancel();
  setStatus("文章已删除。");
  render();
});

elements.saveArticle.addEventListener("click", saveCurrentArticle);
elements.readArticle.addEventListener("click", speakArticle);
elements.stopReading.addEventListener("click", () => {
  window.speechSynthesis?.cancel();
  activeUtterance = null;
  clearReadingState();
  setStatus("已停止朗读。");
});

elements.speechRate.addEventListener("input", () => {
  elements.rateValue.textContent = `${Number(elements.speechRate.value).toFixed(2)}x`;
  if (activeUtterance) {
    setStatus("速度会在下一句朗读时生效。");
  }
});

elements.voiceSelect.addEventListener("change", () => {
  preferredVoiceName = elements.voiceSelect.value;
  localStorage.setItem(voiceStorageKey, preferredVoiceName);
  setStatus("已切换朗读语音。");
});

window.addEventListener("beforeunload", () => {
  persistCurrentInputs();
  saveArticles();
});

applyTheme(preferredTheme);
populateVoiceOptions();
window.speechSynthesis?.addEventListener?.("voiceschanged", populateVoiceOptions);
render({ persist: !canUseServerSync });
loadServerArticles().then(() => translateMissingSentences());
