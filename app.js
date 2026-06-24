const DATA = window.__HKICPA_STUDY_DATA__ || { resources: [], questions: [] };

const viewSwitch = document.querySelectorAll(".view-tab");
const resourcesView = document.getElementById("resources-view");
const questionsView = document.getElementById("questions-view");

const searchInput = document.getElementById("search");
const categorySelect = document.getElementById("category");
const modeSelect = document.getElementById("mode");
const doctypeSelect = document.getElementById("doctype");
const statsEl = document.getElementById("stats");
const moduleGrid = document.getElementById("module-grid");

const questionSearchInput = document.getElementById("question-search");
const questionCategorySelect = document.getElementById("question-category");
const questionModuleSelect = document.getElementById("question-module");
const questionYearSelect = document.getElementById("question-year");
const questionSessionSelect = document.getElementById("question-session");
const questionAnswerFilter = document.getElementById("question-answer-filter");
const questionStatsEl = document.getElementById("question-stats");
const questionGrid = document.getElementById("question-grid");
const practiceCard = document.getElementById("question-practice");
const practiceRandomBtn = document.getElementById("random-question");
const practiceNextBtn = document.getElementById("next-question");

const previewModal = document.getElementById("question-preview-modal");
const previewTitle = document.getElementById("preview-title");
const previewMeta = document.getElementById("preview-meta");
const previewFrame = document.getElementById("preview-frame");
const previewStatus = document.getElementById("preview-status");
const previewClose = document.getElementById("close-preview");

const state = {
  currentView: "resources",
  filteredQuestionSeed: [],
  currentPracticeIndex: 0,
};

function formatDate(value) {
  if (!value) return "未知";
  return new Date(value).toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" });
}

function cleanFileHref(value) {
  if (!value) return "";
  return String(value).split("#")[0];
}

function isRemoteResource(value) {
  const normalized = String(value || "");
  return normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("/");
}

function buildPdfAnchor(filePath, pageNumber) {
  if (!filePath) {
    return "#";
  }
  const page = Number(pageNumber) > 0 ? Number(pageNumber) : 1;
  return `${cleanFileHref(filePath)}#page=${page}&zoom=page-width`;
}

function buildFolderLink(filePath) {
  if (!filePath) {
    return "#";
  }
  if (isRemotePathLike(filePath)) {
    return "#";
  }
  const idx = filePath.lastIndexOf("/");
  const folderPath = idx >= 0 ? filePath.substring(0, idx) : filePath;
  return encodeURI(`file:///${folderPath.replace(/\\/g, "/")}`);
}

function isRemotePathLike(value) {
  const normalized = String(value || "");
  return normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("/");
}

function disableAction(action, title) {
  action.classList.add("is-disabled");
  action.setAttribute("aria-disabled", "true");
  action.setAttribute("role", "link");
  action.addEventListener("click", (event) => {
    event.preventDefault();
  });
  if (title) {
    action.title = title;
  }
}

function getFileName(item) {
  return item.name || item.path.split("/").pop();
}

function uniqueModules(resources) {
  const grouped = new Map();
  for (const item of resources) {
    const key = `${item.category}::${item.module}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  return grouped;
}

function uniqueArray(items) {
  return [...new Set(items)].sort((a, b) => String(a).localeCompare(String(b)));
}

function formatAnswerLine(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .trim();
}

function normalizeQuestionMode(mode) {
  return mode === "ocr" ? "OCR" : "文本提取";
}

function setPreviewStatus(message, tone = "loading") {
  if (!previewStatus) {
    return;
  }
  previewStatus.textContent = message;
  previewStatus.classList.remove("hidden", "is-error");
  if (tone === "error") {
    previewStatus.classList.add("is-error");
  }
}

function clearPreviewStatus() {
  if (!previewStatus) {
    return;
  }
  previewStatus.textContent = "";
  previewStatus.classList.add("hidden");
  previewStatus.classList.remove("is-error");
}

function showPreview(question) {
  if (!question?.resourceId || !previewModal) {
    return;
  }

  const sourcePage = Number(question.sourcePage);
  const page = Number.isFinite(sourcePage) && sourcePage > 0 ? sourcePage : 1;
  const pageAnchor = buildPdfAnchor(question.resourceId, page);
  const sourceMetaText = question.sourceMatch ? `定位片段：${question.sourceMatch}` : "定位片段：暂无";
  const sourceLabel = `来源: ${normalizeQuestionMode(question.sourceMode)} · 第 ${page} 页`;

  previewTitle.textContent = "题目原页预览";
  previewMeta.textContent = `${sourceLabel} · ${sourceMetaText}`;

  if (!question.previewAvailable || !pageAnchor || pageAnchor === "#") {
    setPreviewStatus("该题目前不支持原题页预览（资源未提供可浏览 PDF 链接）", "error");
    previewFrame.src = "about:blank";
    previewModal.classList.add("open");
    return;
  }

  previewFrame.src = "about:blank";
  setPreviewStatus(`加载原题页（第 ${page} 页）中，请稍候...`);
  previewFrame.src = pageAnchor;
  previewModal.classList.add("open");
}

function hidePreview() {
  previewModal.classList.remove("open");
  previewFrame.src = "about:blank";
  clearPreviewStatus();
}

function setTab(view) {
  state.currentView = view;
  resourcesView.classList.toggle("hidden", view !== "resources");
  questionsView.classList.toggle("hidden", view !== "questions");
  moduleGrid.classList.toggle("hidden", view !== "resources");
  questionGrid.classList.toggle("hidden", view !== "questions");
  questionStatsEl.classList.toggle("hidden", view !== "questions");
  statsEl.classList.toggle("hidden", view !== "resources");
  viewSwitch.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === view);
  });
  if (view === "questions") {
    renderQuestions();
  } else {
    practiceCard.classList.add("hidden");
    practiceCard.innerHTML = "";
  }
}

function ensureQuestionSelectOptions() {
  const questions = DATA.questions || [];
  const byCategory = questions.map((q) => q.category).filter(Boolean);
  const byModule = questions.map((q) => q.module).filter(Boolean);
  const byYear = questions.map((q) => q.year).filter(Boolean);
  const bySession = questions.map((q) => q.session).filter(Boolean);

  questionCategorySelect.innerHTML =
    '<option value="all">全部阶段</option>' +
    uniqueArray(byCategory).map((value) => `<option value="${value}">${value}</option>`).join("");
  questionModuleSelect.innerHTML =
    '<option value="all">全部模块</option>' +
    uniqueArray(byModule).map((value) => `<option value="${value}">${value}</option>`).join("");
  questionYearSelect.innerHTML =
    '<option value="all">全部年份</option>' +
    uniqueArray(byYear).map((value) => `<option value="${value}">${value}</option>`).join("");
  questionSessionSelect.innerHTML =
    '<option value="all">全部场次</option>' +
    uniqueArray(bySession).map((value) => `<option value="${value}">${value}</option>`).join("");
}

function renderResources() {
  const keyword = (searchInput.value || "").trim().toLowerCase();
  const categoryValue = categorySelect.value;
  const modeValue = modeSelect.value;
  const doctypeValue = doctypeSelect.value;

  const matched = DATA.resources.filter((item) => {
    if (categoryValue !== "all" && item.category !== categoryValue) return false;
    if (modeValue !== "all" && item.kind !== modeValue) return false;
    if (doctypeValue !== "all" && item.type !== doctypeValue) return false;

    const haystack = `${item.name} ${item.module} ${item.category} ${item.kind} ${item.type} ${item.session} ${item.year}`.toLowerCase();
    return !keyword || haystack.includes(keyword);
  });

  const grouped = uniqueModules(matched);
  const groups = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));

  statsEl.textContent = `共找到 ${matched.length} 个文件，当前筛选共 ${groups.length} 个模块。`;
  moduleGrid.innerHTML = "";

  if (!groups.length) {
    moduleGrid.innerHTML = '<div class="empty">没有找到匹配的资料，请调整关键字或筛选条件。</div>';
    return;
  }

  for (const [moduleKey, items] of groups) {
    const [category, module] = moduleKey.split("::");
    const container = document.createElement("section");
    container.className = "module-block";

    const title = document.createElement("h2");
    title.className = "module-title";
    title.innerHTML = `<span>${category} - ${module}</span><span class="module-meta">${items.length}份资料</span>`;

    const content = document.createElement("div");
    content.className = "module-content";

    for (const item of items.sort((a, b) => {
      const byType = a.type.localeCompare(b.type);
      if (byType !== 0) return byType;
      if (b.year !== a.year) return b.year - a.year;
      return a.name.localeCompare(b.name);
    })) {
      const row = document.createElement("article");
      row.className = "item";

      const head = document.createElement("div");
      head.className = "item-head";
      const titleNode = document.createElement("p");
      titleNode.className = "item-title";
      titleNode.textContent = getFileName(item);
      head.appendChild(titleNode);

      const chips = document.createElement("div");
      chips.className = "chip-row";
      chips.innerHTML = `
        <span class="chip">${item.kind}</span>
        <span class="chip">${item.type}</span>
        ${item.year ? `<span class="chip">${item.year}</span>` : ""}
        ${item.session ? `<span class="chip">${item.session}</span>` : ""}
        ${item.questionCount ? `<span class="chip">题目 ${item.questionCount}</span>` : ""}
        ${item.answerCount ? `<span class="chip">对应答案 ${item.answerCount}</span>` : ""}
      `;

      const hints = document.createElement("div");
      hints.className = "hint";
      hints.textContent = `最后更新: ${formatDate(item.lastModified)} · ${item.sizeMB} MB`;

      const actions = document.createElement("div");
      actions.className = "item-actions";

      const openLink = document.createElement("a");
      openLink.className = "btn open-btn";
      openLink.textContent = "打开文件";
      openLink.href = cleanFileHref(item.id);
      openLink.target = "_blank";
      openLink.rel = "noopener noreferrer";
      openLink.title = item.id ? "在新窗口打开原文件" : "原文件链接不存在";
      if (!item.id) {
        disableAction(openLink, "原文件链接不存在");
      }

      const folderLink = document.createElement("a");
      folderLink.className = "btn folder-btn";
      folderLink.textContent = "打开目录";
      folderLink.href = buildFolderLink(item.path);
      folderLink.target = "_blank";
      folderLink.rel = "noopener noreferrer";
      folderLink.title = isRemoteResource(item.id)
        ? "在线版不支持打开本地目录"
        : `打开 ${getFileName(item)} 所在目录`;
      if (isRemoteResource(item.id) || !folderLink.href || folderLink.href === "#") {
        disableAction(folderLink, "在线版不支持打开本地目录");
      }

      actions.appendChild(openLink);
      actions.appendChild(folderLink);

      row.appendChild(head);
      row.appendChild(chips);
      row.appendChild(hints);
      row.appendChild(actions);
      content.appendChild(row);
    }

    title.addEventListener("click", () => {
      container.classList.toggle("open");
    });
    container.appendChild(title);
    container.appendChild(content);
    moduleGrid.appendChild(container);
  }
}

function getFilteredQuestions() {
  const keyword = (questionSearchInput.value || "").trim().toLowerCase();
  const categoryValue = questionCategorySelect.value;
  const moduleValue = questionModuleSelect.value;
  const yearValue = questionYearSelect.value;
  const sessionValue = questionSessionSelect.value;
  const answerFilter = questionAnswerFilter.value;

  return (DATA.questions || []).filter((item) => {
    if (categoryValue !== "all" && item.category !== categoryValue) return false;
    if (moduleValue !== "all" && item.module !== moduleValue) return false;
    if (yearValue !== "all" && String(item.year || "0") !== yearValue) return false;
    if (sessionValue !== "all" && item.session !== sessionValue) return false;
    if (answerFilter === "with-answer" && !item.hasAnswer) return false;
    if (answerFilter === "without-answer" && item.hasAnswer) return false;

    const haystack = `${item.number} ${item.module} ${item.category} ${item.session} ${item.year} ${item.prompt} ${item.full}`.toLowerCase();
    return !keyword || haystack.includes(keyword);
  });
}

function createQuestionNode(question) {
  const item = document.createElement("article");
  item.className = "question-card";

  const head = document.createElement("header");
  head.className = "question-head";
  const title = document.createElement("div");
  const qText = document.createElement("h3");
  qText.textContent = `${question.module} ${question.category === "11-14" ? "11-14" : ""} 题号 ${question.number}（${question.year || "年份未知"} ${question.session || "场次未知"}）`;
  const tags = document.createElement("div");
  tags.className = "chip-row";
  tags.innerHTML = `
    <span class="chip">${question.hasAnswer ? "有参考答案" : "无参考答案"}</span>
    <span class="chip">来源页码：第 ${question.sourcePage || "N"} 页</span>
    <span class="chip">解析来源：${question.sourceMode === "ocr" ? "OCR" : "文本提取"}</span>
  `;
  title.appendChild(qText);
  title.appendChild(tags);
  head.appendChild(title);
  const sourceMeta = document.createElement("p");
  sourceMeta.className = "question-source-match";
  sourceMeta.textContent = `定位片段：${(question.sourceMatch || "未命中").trim()}`;

  const prompt = document.createElement("pre");
  prompt.className = "question-text";
  prompt.textContent = formatAnswerLine(question.prompt || question.full || "");

  const options = document.createElement("div");
  options.className = "options";
  if ((question.options || []).length) {
    const ol = document.createElement("ol");
    for (const opt of question.options) {
      const li = document.createElement("li");
      li.textContent = opt;
      ol.appendChild(li);
    }
    options.appendChild(ol);
  }

  const answerWrap = document.createElement("section");
  answerWrap.className = "answer-wrap hidden";

  const answerLabel = document.createElement("div");
  answerLabel.className = "answer-label";
  answerLabel.textContent = "答案解析（含建议答案）";

  const answer = document.createElement("pre");
  answer.className = "answer-text";
  answer.textContent = formatAnswerLine(question.answer || "这题暂无提取到可显示答案，建议先看原文件解析。");

  answerWrap.appendChild(answerLabel);
  answerWrap.appendChild(answer);

  const actionRow = document.createElement("div");
  actionRow.className = "item-actions";

  const reveal = document.createElement("button");
  reveal.type = "button";
  reveal.className = "btn answer-btn";
  reveal.textContent = "查看答案";

  const preview = document.createElement("button");
  preview.type = "button";
  preview.className = "btn open-btn preview-btn";
  preview.textContent = "查看原题页";
  preview.disabled = !question.previewAvailable;
  preview.addEventListener("click", () => {
    showPreview(question);
  });

  const openSource = document.createElement("a");
  openSource.className = "btn open-btn";
  openSource.textContent = "打开原题";
  openSource.href = question.resourceId
    ? question.previewAvailable
      ? buildPdfAnchor(question.resourceId, question.sourcePage)
      : cleanFileHref(question.resourceId)
    : "#";
  const openSourcePage = Number(question.sourcePage) > 0 ? question.sourcePage : 1;
  openSource.title = question.resourceId
    ? question.previewAvailable
      ? `在新窗口打开原题（第 ${openSourcePage} 页）`
      : "在新窗口打开原题文件"
    : "原题文件不存在";
  openSource.target = "_blank";
  openSource.rel = "noopener noreferrer";
  if (!question.resourceId) {
    disableAction(openSource, "原题文件不存在");
  }

  reveal.addEventListener("click", () => {
    const shouldShow = answerWrap.classList.toggle("hidden");
    reveal.textContent = shouldShow ? "查看答案" : "隐藏答案";
  });

  actionRow.appendChild(reveal);
  actionRow.appendChild(preview);
  actionRow.appendChild(openSource);

  item.appendChild(head);
  item.appendChild(sourceMeta);
  item.appendChild(prompt);
  item.appendChild(options);
  item.appendChild(answerWrap);
  item.appendChild(actionRow);
  return item;
}

function renderQuestions() {
  const filtered = getFilteredQuestions();
  state.filteredQuestionSeed = filtered;
  questionStatsEl.textContent = `共 ${filtered.length} 道题`;

  practiceCard.innerHTML = "";
  questionGrid.innerHTML = "";
  practiceNextBtn.disabled = !filtered.length;

  if (!filtered.length) {
    questionGrid.innerHTML = '<div class="empty">没有找到匹配题目，请调整筛选条件。</div>';
    return;
  }

  for (const question of filtered) {
    questionGrid.appendChild(createQuestionNode(question));
  }
}

function showPracticeQuestion() {
  const pool = state.filteredQuestionSeed.length ? state.filteredQuestionSeed : getFilteredQuestions();
  if (!pool.length) {
    practiceCard.innerHTML = "";
    return;
  }

  const nextIndex = Math.floor(Math.random() * pool.length);
  state.currentPracticeIndex = nextIndex;
  const question = pool[nextIndex];

  const title = document.createElement("div");
  title.className = "question-practice-title";
  title.textContent = "随机题目";

  const node = createQuestionNode(question);
  node.classList.add("practice-active");
  practiceCard.classList.remove("hidden");
  practiceCard.innerHTML = "";
  practiceCard.appendChild(title);
  practiceCard.appendChild(node);
}

function initializeViewState() {
  const hasData = Boolean(DATA.resources && DATA.resources.length) || Boolean(DATA.questions && DATA.questions.length);
  if (!hasData) {
    moduleGrid.innerHTML = '<div class="empty">未检测到数据，请先运行扫描脚本（见 scripts/build-study-index.js）。</div>';
    questionGrid.innerHTML = '<div class="empty">未检测到题库数据，请先运行扫描脚本（见 scripts/build-study-index.js）。</div>';
    return;
  }

  ensureQuestionSelectOptions();
  renderResources();
  renderQuestions();
  setTab("resources");
}

function bindEvents() {
  viewSwitch.forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.view));
  });

  searchInput?.addEventListener("input", renderResources);
  categorySelect?.addEventListener("change", renderResources);
  modeSelect?.addEventListener("change", renderResources);
  doctypeSelect?.addEventListener("change", renderResources);

  questionSearchInput?.addEventListener("input", renderQuestions);
  questionCategorySelect?.addEventListener("change", renderQuestions);
  questionModuleSelect?.addEventListener("change", renderQuestions);
  questionYearSelect?.addEventListener("change", renderQuestions);
  questionSessionSelect?.addEventListener("change", renderQuestions);
  questionAnswerFilter?.addEventListener("change", renderQuestions);

  practiceRandomBtn?.addEventListener("click", showPracticeQuestion);
  practiceNextBtn?.addEventListener("click", showPracticeQuestion);

  previewFrame?.addEventListener("load", () => {
    if (!previewModal?.classList.contains("open")) {
      return;
    }
    clearPreviewStatus();
  });

  previewFrame?.addEventListener("error", () => {
    setPreviewStatus("原题页加载失败，请确认本地 PDF 可访问。", "error");
  });

  previewClose?.addEventListener("click", hidePreview);

  previewModal?.addEventListener("click", (event) => {
    if (event.target === previewModal) {
      hidePreview();
    }
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && previewModal?.classList.contains("open")) {
    hidePreview();
  }
});

if (!DATA.resources.length && !DATA.questions.length) {
  initializeViewState();
} else {
  initializeViewState();
}

bindEvents();
