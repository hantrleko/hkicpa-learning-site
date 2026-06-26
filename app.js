const DATA = window.__HKICPA_STUDY_DATA__ || { resources: [], questions: [] };

const viewSwitch = document.querySelectorAll(".view-tab");
const labView = document.getElementById("lab-view");
const resourcesView = document.getElementById("resources-view");
const questionsView = document.getElementById("questions-view");
const studyView = document.getElementById("study-view");

const searchInput = document.getElementById("search");
const categorySelect = document.getElementById("category");
const modeSelect = document.getElementById("mode");
const doctypeSelect = document.getElementById("doctype");
const resourceModuleSelect = document.getElementById("resource-module");
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
const questionSeqBtn = document.getElementById("question-seq");
const questionRandomBtn = document.getElementById("question-random");
const questionPrevBtn = document.getElementById("question-prev");
const questionNextBtn = document.getElementById("question-next");

const studyModuleSelect = document.getElementById("study-module");
const studyAnswerFilter = document.getElementById("study-answer-filter");
const studySectionSelect = document.getElementById("study-section");
const studySectionPills = document.getElementById("study-section-pills");
const studyStatsEl = document.getElementById("study-stats");
const studyQuestionPractice = document.getElementById("study-question-practice");
const studySummary = document.getElementById("study-summary");
const studySeqBtn = document.getElementById("study-seq");
const studyRandomBtn = document.getElementById("study-random");
const studyPrevBtn = document.getElementById("study-prev");
const studyNextBtn = document.getElementById("study-next");

const previewModal = document.getElementById("question-preview-modal");
const previewTitle = document.getElementById("preview-title");
const previewMeta = document.getElementById("preview-meta");
const previewFrame = document.getElementById("preview-frame");
const previewStatus = document.getElementById("preview-status");
const previewClose = document.getElementById("close-preview");

const labTaskTitle = document.getElementById("lab-task-title");
const labContext = document.getElementById("lab-context");
const labSidebarCase = document.getElementById("lab-sidebar-case");
const labTaskTabs = document.getElementById("lab-task-tabs");
const labTimerValue = document.getElementById("lab-timer-value");
const labTimerToggle = document.getElementById("lab-timer-toggle");
const labTimerReset = document.getElementById("lab-timer-reset");
const labTaskMarks = document.getElementById("lab-task-marks");
const labTaskTime = document.getElementById("lab-task-time");
const labTaskStandard = document.getElementById("lab-task-standard");
const labQuestionHeading = document.getElementById("lab-question-heading");
const labQuestionPrompt = document.getElementById("lab-question-prompt");
const labKeyFacts = document.getElementById("lab-key-facts");
const labAnswerInput = document.getElementById("lab-answer-input");
const labSaveNote = document.getElementById("lab-save-note");
const labMarkComplete = document.getElementById("lab-mark-complete");
const labSaveStatus = document.getElementById("lab-save-status");
const labInsightTabs = document.querySelectorAll(".lab-insight-tab");
const labInsightContent = document.getElementById("lab-insight-content");
const labSidebarProgress = document.getElementById("lab-sidebar-progress");
const labWeaknessFocus = document.getElementById("lab-weakness-focus");
const labNextStep = document.getElementById("lab-next-step");

const state = {
  currentView: "lab",
  filteredQuestionSeed: [],
  practice: {
    mode: "sequence",
    order: [],
    pointer: -1,
  },
  study: {
    mode: "sequence",
    module: "M1",
    section: "all",
    pool: [],
    order: [],
    pointer: -1,
  },
  lab: {
    activeTask: "q1",
    activePanel: "answer",
    timerSeconds: 50 * 60,
    timerRunning: false,
    timerId: null,
    completed: new Set(),
  },
};

const LAB_STORAGE_KEY = "hkicpa-m11-prototype-notes";
const FALLBACK_LAB_SAMPLE = {
  module: "M11",
  session: "Jun 2025",
  title: "M11 Financial Reporting",
  tasks: [
    {
      id: "q1",
      label: "Question 1",
      title: "Disposal of subsidiary and NCI",
      marks: 28,
      minutes: 50,
      standard: "HKFRS 10 / HKFRS 3 / HKAS 36",
      prompt:
        "Argon acquired 90% of Baron and later sold all shares. Calculate goodwill and NCI, then explain the group accounting impact of losing control, including OCI reserve treatment.",
      facts: [
        "Acquisition: 90% interest; NCI measured at proportionate share.",
        "Fair value uplift on machinery: HK$2,500m, 10-year life.",
        "Goodwill impairment review occurred before disposal.",
        "Reserve I is a revaluation reserve; Reserve II relates to FVOCI debt instruments.",
      ],
      answer: [
        "Goodwill starts from consideration plus NCI less fair value of identifiable net assets.",
        "Goodwill impairment is allocated only to the parent when partial goodwill is used.",
        "On loss of control, derecognise subsidiary assets, liabilities, goodwill and NCI, then recognise consideration and disposal gain/loss.",
        "FVOCI debt reserve is reclassified to profit or loss; revaluation reserve is transferred directly to retained earnings.",
      ],
      examiner: [
        "Many candidates selected HKFRS 5 just because the scenario mentioned disposal.",
        "A common miss was ignoring the unamortised fair value adjustment on machinery.",
        "The stronger answers separated reclassifiable OCI from non-reclassifiable OCI.",
      ],
      weakness: ["Loss of control", "Partial goodwill", "NCI movements", "OCI recycling"],
      next: "复盘 HKFRS 10 loss of control，并补一题 OCI reserve treatment。",
    },
    {
      id: "q2",
      label: "Question 2",
      title: "Derecognition and sale-and-leaseback",
      marks: 16,
      minutes: 29,
      standard: "Conceptual Framework / HKFRS 16 / HKFRS 9",
      prompt:
        "Analyse whether Argon should derecognise a specialised machine sold and leased back, and trade receivables factored to a bank with compensation obligation.",
      facts: [
        "The transfer of the machine qualifies as a sale under HKFRS 15.",
        "Argon retains 40% of the rights through the leaseback.",
        "Receivables were legally transferred, but Argon compensates the bank if the customer fails to pay.",
        "The director wants to keep assets on the statement of financial position to support borrowing.",
      ],
      answer: [
        "Derecognition means removing an asset or liability that no longer meets recognition criteria.",
        "For sale-and-leaseback, recognise only the gain related to rights transferred to the buyer-lessor.",
        "For receivables, assess transfer of rights and substantially all risks and rewards under HKFRS 9.",
        "Accounting treatment cannot be chosen to maintain a larger asset base.",
      ],
      examiner: [
        "Many candidates wasted time proving a sale even though the case already stated it qualified.",
        "Candidates often confused rights retained with rights transferred in the HKFRS 16 calculation.",
        "Conceptual Framework derecognition was frequently replaced by asset-specific rules.",
      ],
      weakness: ["Derecognition principle", "Sale-and-leaseback", "Risk and reward transfer", "Exam requirement reading"],
      next: "先写 Conceptual Framework 定义，再做 HKFRS 16/HKFRS 9 分析。",
    },
    {
      id: "q3",
      label: "Question 3",
      title: "ESG disclosure linkage",
      marks: 6,
      minutes: 11,
      standard: "ESG reporting",
      prompt:
        "Explain the ESG reporting implications for a listed industrial group with labour, safety, demographic and environmental concerns.",
      facts: [
        "Argon is listed on HKEX and prepares ESG reports.",
        "The group relies on a highly skilled workforce in a traditionally male-dominated industry.",
        "The disposal decision was partly driven by environmental impact concerns.",
      ],
      answer: [
        "Identify material ESG topics and link disclosure to the facts in the case.",
        "Discuss human capital, occupational health and safety, diversity, and environmental impacts.",
        "Use case-specific disclosure language rather than generic ESG slogans.",
      ],
      examiner: [
        "Performance was stronger on ESG than on complex consolidation topics.",
        "High-scoring answers tied ESG comments directly to the case facts.",
      ],
      weakness: ["Case-specific ESG", "Materiality", "Disclosure wording"],
      next: "把 ESG 答案写成 case facts + disclosure implication 的两列表。",
    },
  ],
};

const LAB_CASES = Array.isArray(window.__HKICPA_LAB_CASES__) ? window.__HKICPA_LAB_CASES__ : [];
const LAB_SAMPLE = LAB_CASES.find((item) => item.id === "m11-jun-2025") || LAB_CASES[0] || FALLBACK_LAB_SAMPLE;

function getStoredLabNotes() {
  try {
    return JSON.parse(localStorage.getItem(LAB_STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function setStoredLabNotes(notes) {
  localStorage.setItem(LAB_STORAGE_KEY, JSON.stringify(notes || {}));
}

function formatTimer(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function getActiveLabTask() {
  return LAB_SAMPLE.tasks.find((task) => task.id === state.lab.activeTask) || LAB_SAMPLE.tasks[0];
}

function resetLabTimer(task = getActiveLabTask()) {
  state.lab.timerRunning = false;
  if (state.lab.timerId) {
    clearInterval(state.lab.timerId);
    state.lab.timerId = null;
  }
  state.lab.timerSeconds = Number(task.minutes || 50) * 60;
  renderLabTimer();
}

function renderLabTimer() {
  if (labTimerValue) {
    labTimerValue.textContent = formatTimer(state.lab.timerSeconds);
    labTimerValue.classList.toggle("is-low", state.lab.timerSeconds <= 5 * 60);
  }
  if (labTimerToggle) {
    labTimerToggle.textContent = state.lab.timerRunning ? "Ⅱ" : "▶";
  }
}

function toggleLabTimer() {
  if (state.lab.timerRunning) {
    state.lab.timerRunning = false;
    clearInterval(state.lab.timerId);
    state.lab.timerId = null;
    renderLabTimer();
    return;
  }

  state.lab.timerRunning = true;
  state.lab.timerId = setInterval(() => {
    state.lab.timerSeconds = Math.max(0, state.lab.timerSeconds - 1);
    if (state.lab.timerSeconds === 0) {
      state.lab.timerRunning = false;
      clearInterval(state.lab.timerId);
      state.lab.timerId = null;
    }
    renderLabTimer();
  }, 1000);
  renderLabTimer();
}

function createLabList(items, className = "lab-point-list") {
  const list = document.createElement("ul");
  list.className = className;
  for (const item of items || []) {
    const row = document.createElement("li");
    row.textContent = item;
    list.appendChild(row);
  }
  return list;
}

function renderLabInsights(task = getActiveLabTask()) {
  if (!labInsightContent) return;

  labInsightTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.labPanel === state.lab.activePanel);
  });

  labInsightContent.innerHTML = "";
  const title = document.createElement("h3");
  title.textContent =
    state.lab.activePanel === "answer"
      ? "标准答案骨架"
      : state.lab.activePanel === "examiner"
        ? "Panelists report 提醒"
        : "错因标签";
  labInsightContent.appendChild(title);

  if (state.lab.activePanel === "weakness") {
    const wrap = document.createElement("div");
    wrap.className = "lab-tag-cloud";
    for (const tag of task.weakness || []) {
      const chip = document.createElement("span");
      chip.textContent = tag;
      wrap.appendChild(chip);
    }
    labInsightContent.appendChild(wrap);
    return;
  }

  labInsightContent.appendChild(
    createLabList(state.lab.activePanel === "answer" ? task.answer : task.examiner),
  );
}

function renderLabProgress() {
  const completed = state.lab.completed.size;
  const total = LAB_SAMPLE.tasks.length;
  if (labSidebarProgress) {
    labSidebarProgress.textContent = `${completed}/${total}`;
  }

  const firstOpen = LAB_SAMPLE.tasks.find((task) => !state.lab.completed.has(task.id)) || getActiveLabTask();
  if (labWeaknessFocus) {
    labWeaknessFocus.textContent = (getActiveLabTask().weakness || [])[0] || "Case-specific analysis";
  }
  if (labNextStep) {
    labNextStep.textContent = firstOpen.next || "继续下一题并复盘考官报告。";
  }
}

function renderLabTaskTabs() {
  if (!labTaskTabs) return;
  labTaskTabs.innerHTML = "";
  for (const task of LAB_SAMPLE.tasks) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `lab-task-tab ${task.id === state.lab.activeTask ? "is-active" : ""}`;
    button.dataset.taskId = task.id;
    button.innerHTML = `<strong>${task.label}</strong><span>${task.marks} marks · ${task.minutes} min</span>`;
    if (state.lab.completed.has(task.id)) {
      button.classList.add("is-complete");
    }
    button.addEventListener("click", () => {
      state.lab.activeTask = task.id;
      resetLabTimer(task);
      renderLab();
    });
    labTaskTabs.appendChild(button);
  }
}

function renderLab() {
  if (!labView) return;
  const task = getActiveLabTask();
  const notes = getStoredLabNotes();

  if (labContext) {
    labContext.textContent = `${LAB_SAMPLE.module} ${LAB_SAMPLE.moduleTitle || LAB_SAMPLE.title} · ${LAB_SAMPLE.session}`;
  }
  if (labSidebarCase) {
    labSidebarCase.textContent = `${LAB_SAMPLE.module} ${LAB_SAMPLE.session}`;
  }
  if (labTaskTitle) labTaskTitle.textContent = task.title;
  if (labTaskMarks) labTaskMarks.textContent = `${task.marks} marks`;
  if (labTaskTime) labTaskTime.textContent = `${task.minutes} minutes`;
  if (labTaskStandard) {
    const sourcePage = task.sourcePages?.question ? ` · Q p.${task.sourcePages.question}` : "";
    labTaskStandard.textContent = `${task.standard}${sourcePage}`;
  }
  if (labQuestionHeading) labQuestionHeading.textContent = task.label;
  if (labQuestionPrompt) labQuestionPrompt.textContent = task.prompt;
  if (labAnswerInput) labAnswerInput.value = notes[task.id] || "";
  if (labSaveStatus) labSaveStatus.textContent = "";
  if (labMarkComplete) {
    labMarkComplete.textContent = state.lab.completed.has(task.id) ? "已完成" : "标记完成";
  }

  if (labKeyFacts) {
    labKeyFacts.innerHTML = "";
    for (const fact of task.facts || []) {
      const item = document.createElement("div");
      item.textContent = fact;
      labKeyFacts.appendChild(item);
    }
  }

  renderLabTaskTabs();
  renderLabTimer();
  renderLabInsights(task);
  renderLabProgress();
}

function saveLabNote() {
  const task = getActiveLabTask();
  const notes = getStoredLabNotes();
  notes[task.id] = labAnswerInput?.value || "";
  setStoredLabNotes(notes);
  if (labSaveStatus) {
    labSaveStatus.textContent = "已保存到本机浏览器";
  }
}

function markLabComplete() {
  const task = getActiveLabTask();
  state.lab.completed.add(task.id);
  saveLabNote();
  renderLab();
}

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

function getQuestionSectionKey(question) {
  const base = question || {};
  if (base.groupKey) {
    return String(base.groupKey);
  }
  const category = String(base.category || "未知");
  const module = String(base.module || "未分类");
  const year = String(base.year || "未标注");
  const session = String(base.session || "未标注");
  return `${category}|${module}|${year}|${session}`;
}

function getQuestionSectionLabel(question) {
  const key = getQuestionSectionKey(question);
  const parts = key.split("|");
  if (parts.length >= 4) {
    const year = parts[2] || "未知";
    const session = parts[3] || "未标注";
    return `${year} ${session}`;
  }
  if (question?.year || question?.session) {
    return `${question.year || "未知"} ${question.session || "未标注"}`;
  }
  return "未标注场次";
}

function renderStudySectionPills(buckets, selectedValue = "all") {
  if (!studySectionPills) {
    return;
  }

  const total = Array.isArray(buckets) ? buckets.reduce((sum, item) => sum + (Number(item.count) || 0), 0) : 0;
  const normalizedSelected = selectedValue || "all";
  studySectionPills.innerHTML = "";

  const allPill = document.createElement("button");
  allPill.type = "button";
  allPill.className = `study-section-pill ${normalizedSelected === "all" ? "is-active" : ""}`;
  allPill.textContent = `全部场次 (${total})`;
  allPill.dataset.section = "all";
  if (total === 0) {
    allPill.disabled = true;
  }
  allPill.addEventListener("click", () => {
    if (studySectionSelect) {
      studySectionSelect.value = "all";
    }
    renderStudyMode();
  });
  studySectionPills.appendChild(allPill);

  if (!Array.isArray(buckets) || !buckets.length) {
    return;
  }

  for (const item of buckets) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `study-section-pill ${normalizedSelected === item.key ? "is-active" : ""}`;
    button.textContent = `${item.label} (${item.count})`;
    button.dataset.section = item.key;
    button.disabled = item.count <= 0;
    button.addEventListener("click", () => {
      if (studySectionSelect) {
        studySectionSelect.value = item.key;
      }
      renderStudyMode();
    });
    studySectionPills.appendChild(button);
  }
}

function compareSectionKey(left, right) {
  const leftParts = String(left).split("|");
  const rightParts = String(right).split("|");
  const leftYear = Number(leftParts[2] || 0);
  const rightYear = Number(rightParts[2] || 0);

  if (leftYear !== rightYear) {
    return leftYear - rightYear;
  }

  const leftSession = String(leftParts[3] || "").toLowerCase();
  const rightSession = String(rightParts[3] || "").toLowerCase();
  if (leftSession !== rightSession) {
    return leftSession.localeCompare(rightSession);
  }
  return String(left).localeCompare(String(right));
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

function normalizeAnswerFilter(value) {
  if (value === "with-answer" || value === "without-answer") {
    return value;
  }
  return "all";
}

function formatModuleLabel(module) {
  const value = String(module || "").trim();
  const match = value.match(/^M(\d+)$/i);
  if (!match) {
    return value || "M1";
  }
  return `M${String(Number(match[1])).padStart(2, "0")}`;
}

const STUDY_STOP_WORDS = new Set([
  "answer",
  "answers",
  "required",
  "required:",
  "question",
  "questions",
  "required:",
  "and",
  "the",
  "with",
  "without",
  "this",
  "that",
  "these",
  "those",
  "for",
  "from",
  "into",
  "been",
  "have",
  "has",
  "had",
  "were",
  "there",
  "them",
  "they",
  "when",
  "where",
  "while",
  "which",
  "would",
  "should",
  "could",
  "might",
  "will",
  "your",
  "you",
  "are",
  "was",
  "not",
  "can",
  "all",
  "any",
  "about",
  "into",
  "upon",
  "their",
  "through",
  "within",
  "because",
  "during",
  "therefore",
  "further",
  "between",
  "section",
  "sections",
  "below",
  "marks",
  "mark",
  "following",
  "following:",
  "page",
  "approximately",
  "minute",
  "minutes",
  "together",
  "required",
  "required:",
  "required.",
  "required?",
  "required,",
  "analysis",
  "required:",
]);

const STUDY_PHRASES = [
  "partnership",
  "consolidation",
  "financial statements",
  "cash flow",
  "journal entries",
  "journal entry",
  "foreign currency",
  "goodwill",
  "impairment",
  "finance lease",
  "operating lease",
  "depreciation",
  "revenue",
  "investment",
  "merger",
  "acquisition",
  "consolidated",
  "share-based",
  "share based",
  "share incentives",
  "share option",
  "provision",
  "asset",
  "liability",
  "equity",
  "goodwill",
  "ethical",
  "fraud",
  "error",
  "capital",
  "inventories",
  "disclosure",
  "consolidated financial statements",
];

function formatAnswerLine(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .trim();
}

function createChip(text, tone = "default") {
  const chip = document.createElement("span");
  chip.className = `q-chip q-chip-${tone}`;
  chip.textContent = text;
  return chip;
}

function inferQuestionType(question) {
  const prompt = String(question?.prompt || question?.full || "").toLowerCase();
  const options = Array.isArray(question?.options) ? question.options : [];
  if (options.length > 0) {
    return "选择题 / 多小问";
  }
  if (/\(a\)|\(b\)|\(c\)|\(d\)|\(e\)|\b[a-d]\)|\[a\]|\[b\]|\[c\]/i.test(prompt) || /\b[a-d]\./.test(prompt)) {
    return "分问 / 选项题";
  }
  if (prompt.includes("required") && prompt.includes("answer")) {
    return "按要求作答";
  }
  if (prompt.includes("prepare") || prompt.includes("prepare a") || prompt.includes("prepare the")) {
    return "报表类题目";
  }
  return "书面题 / 计算题";
}

function buildQuestionGuide(question) {
  const prompt = String(question?.prompt || question?.full || "").toLowerCase();
  const type = inferQuestionType(question);
  const lines = [];
  lines.push(`题型判断：${type}`);
  lines.push("学习动作：先抓题干条件，再按顺序落盘，最后再核对结果是否符合题意。");

  if (prompt.includes("required") || prompt.includes("required:")) {
    lines.push("题目关键词提示：建议按“步骤1→步骤2→结论”结构作答，避免漏条件。");
  }
  if (prompt.includes("prepare")) {
    lines.push("建议先做框架，再做计算，最后补齐会计分录/表内金额关系。");
  }
  if (question.sourceMode === "ocr") {
    lines.push("当前题干来自 OCR，建议结合原题页核验关键数字及符号。");
  }

  if (!lines.length) {
    lines.push("先确认题目要求，再逐项计算；题目较长时先定位子问题。");
  }
  return lines;
}

function createQuestionHeader(question) {
  const header = document.createElement("header");
  header.className = "question-card-head";

  const titleWrap = document.createElement("div");

  const title = document.createElement("h3");
  title.className = "q-title";
  title.textContent = `题号 ${question.number || "未标注"}`;

  const titleMeta = document.createElement("p");
  titleMeta.className = "q-title-meta";
  titleMeta.textContent = `${String(question.module || "未分类").toUpperCase()} ${question.category || ""}`.trim();

  const subtitle = document.createElement("p");
  subtitle.className = "q-subtitle";
  subtitle.textContent = `${question.year || "年份未知"} · ${question.session || "场次未知"}`;

  const chips = document.createElement("div");
  chips.className = "q-chip-row";
  chips.appendChild(createChip(question.hasAnswer ? "有参考答案" : "无参考答案", question.hasAnswer ? "ok" : "warning"));
  chips.appendChild(createChip(`来源: ${normalizeQuestionMode(question.sourceMode)}`, "source"));
  chips.appendChild(createChip(`第 ${Number(question.sourcePage) > 0 ? question.sourcePage : "N"} 页`, "source"));

  titleWrap.appendChild(title);
  titleWrap.appendChild(titleMeta);
  titleWrap.appendChild(subtitle);
  header.appendChild(titleWrap);
  header.appendChild(chips);
  return header;
}

function createQuestionBody(question) {
  const body = document.createElement("section");
  body.className = "q-body";

  const guideBlock = document.createElement("section");
  guideBlock.className = "q-block q-block-guide";
  const guideTitle = document.createElement("p");
  guideTitle.className = "q-block-title";
  guideTitle.textContent = "学习导读";
  const guideList = document.createElement("ul");
  guideList.className = "q-guide-list";
  for (const item of buildQuestionGuide(question)) {
    const guideItem = document.createElement("li");
    guideItem.textContent = item;
    guideList.appendChild(guideItem);
  }
  guideBlock.appendChild(guideTitle);
  guideBlock.appendChild(guideList);

  const stemBlock = document.createElement("section");
  stemBlock.className = "q-block";
  const stemBlockTitle = document.createElement("p");
  stemBlockTitle.className = "q-block-title";
  stemBlockTitle.textContent = "题干";
  const stem = document.createElement("div");
  stem.className = "q-stem";
  stem.textContent = formatAnswerLine(question.prompt || question.full || "");
  stemBlock.appendChild(stemBlockTitle);
  stemBlock.appendChild(stem);

  const sourceMeta = document.createElement("p");
  sourceMeta.className = "q-source-snippet";
  sourceMeta.textContent = question.sourceMatch
    ? `定位片段：${question.sourceMatch.trim()}`
    : "定位片段：未命中（请结合原题页）";

  body.appendChild(guideBlock);
  body.appendChild(stemBlock);
  body.appendChild(sourceMeta);

  const options = question.options || [];
  if (options.length) {
    const optionBlock = document.createElement("section");
    optionBlock.className = "q-block";

    const optionTitle = document.createElement("p");
    optionTitle.className = "q-block-title";
    optionTitle.textContent = "选项";

    const optionList = document.createElement("div");
    optionList.className = "q-options";
    let index = 0;
    for (const option of options) {
      index += 1;
      const row = document.createElement("div");
      row.className = "q-option";

      const tag = document.createElement("span");
      tag.className = "q-option-tag";
      tag.textContent = `${String.fromCharCode(64 + index)}.`;

      const text = document.createElement("span");
      text.textContent = option;

      row.appendChild(tag);
      row.appendChild(text);
      optionList.appendChild(row);
    }

    optionBlock.appendChild(optionTitle);
    optionBlock.appendChild(optionList);
    body.appendChild(optionBlock);
  }

  return body;
}

function normalizeQuestionMode(mode) {
  return mode === "ocr" ? "OCR" : "文本提取";
}

function parseModuleQuestions(moduleValue, answerFilterValue = "all") {
  const target = String(moduleValue || "").trim().toUpperCase();
  const normalizedFilter = normalizeAnswerFilter(answerFilterValue);
  return (DATA.questions || []).filter((item) => {
    if (String(item.module || "").toUpperCase() !== target) {
      return false;
    }
    if (normalizedFilter === "with-answer" && !item.hasAnswer) {
      return false;
    }
    if (normalizedFilter === "without-answer" && item.hasAnswer) {
      return false;
    }
    return true;
  });
}

function normalizeKeywordCandidate(sourceText) {
  return String(sourceText || "")
    .toLowerCase()
    .replace(/[-+*/_=|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function gatherStudyInsights(questions) {
  const sourceText = questions
    .map((item) => `${item.prompt || ""} ${item.full || ""} ${item.answer || ""}`)
    .join(" ")
    .toLowerCase();

  const stats = new Map();
  const sentenceCounts = {
    total: questions.length,
    withAnswer: questions.filter((q) => q.hasAnswer).length,
  };
  const yearCounts = new Map();
  const sessionCounts = new Map();

  for (const item of questions) {
    const itemText = `${item.prompt || ""} ${item.full || ""} ${item.answer || ""}`.toLowerCase();
    const year = Number(item.year) || 0;
    const session = String(item.session || "未标注");
    yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    sessionCounts.set(session, (sessionCounts.get(session) || 0) + 1);

    for (const phrase of STUDY_PHRASES) {
      const key = phrase.toLowerCase();
      if (new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(itemText)) {
        const current = stats.get(key) || 0;
        stats.set(key, current + 1);
      }
    }

    const tokens = normalizeKeywordCandidate(itemText)
      .split(" ")
      .map((value) => value.replace(/[^a-z0-9/]/g, "").trim())
      .filter((value) => value && value.length >= 5)
      .filter((value) => !STUDY_STOP_WORDS.has(value));
    for (const token of tokens) {
      const score = (stats.get(token) || 0) + 1;
      stats.set(token, score);
    }
  }

  for (const match of sourceText.matchAll(/\bhk(?:frs|ias)\s*\d{1,2}(?:\.\d+)?\b/g)) {
    const key = match[0].toUpperCase().replace(/\s+/g, " ").trim();
    stats.set(key, (stats.get(key) || 0) + 1);
  }

  const topKeywords = [...stats.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .map(([word]) => word)
    .slice(0, 12)
    .filter(Boolean);

  const byYear = [...yearCounts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, count]) => ({ year, count }));

  const bySession = [...sessionCounts.entries()]
    .map(([session, count]) => ({ session, count }))
    .sort((a, b) => String(b.session).localeCompare(String(a.session)));

  return {
    sentenceCounts,
    byYear,
    bySession,
    topKeywords,
  };
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
  document.body.dataset.view = view;
  labView?.classList.toggle("hidden", view !== "lab");
  resourcesView.classList.toggle("hidden", view !== "resources");
  questionsView.classList.toggle("hidden", view !== "questions");
  studyView.classList.toggle("hidden", view !== "study");
  moduleGrid.classList.toggle("hidden", view !== "resources");
  questionGrid.classList.toggle("hidden", view !== "questions");
  questionStatsEl.classList.toggle("hidden", view !== "questions");
  if (studyStatsEl) {
    studyStatsEl.classList.toggle("hidden", view !== "study");
  }
  statsEl.classList.toggle("hidden", view !== "resources");
  viewSwitch.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === view);
  });
  if (view === "lab") {
    renderLab();
    practiceCard.classList.add("hidden");
    practiceCard.innerHTML = "";
    studyQuestionPractice?.classList.add("hidden");
  } else if (view === "questions") {
    renderQuestions();
  } else if (view === "study") {
    renderStudyMode();
  } else {
    practiceCard.classList.add("hidden");
    practiceCard.innerHTML = "";
    studyQuestionPractice?.classList.add("hidden");
  }
}

function ensureQuestionSelectOptions() {
  const questions = DATA.questions || [];
  const resources = DATA.resources || [];
  const byCategory = questions.map((q) => q.category).filter(Boolean);
  const questionModules = questions.map((q) => q.module).filter(Boolean);
  const resourceModules = resources.map((r) => r.module).filter(Boolean);
  const byYear = questions.map((q) => q.year).filter(Boolean);
  const bySession = questions.map((q) => q.session).filter(Boolean);

  questionCategorySelect.innerHTML =
    '<option value="all">全部阶段</option>' +
    uniqueArray(byCategory).map((value) => `<option value="${value}">${value}</option>`).join("");
  questionModuleSelect.innerHTML =
    '<option value="all">全部章节</option>' +
    uniqueArray(questionModules).map((value) => `<option value="${value}">${value}</option>`).join("");
  questionYearSelect.innerHTML =
    '<option value="all">全部年份</option>' +
    uniqueArray(byYear).map((value) => `<option value="${value}">${value}</option>`).join("");
  questionSessionSelect.innerHTML =
    '<option value="all">全部场次</option>' +
    uniqueArray(bySession).map((value) => `<option value="${value}">${value}</option>`).join("");
  resourceModuleSelect.innerHTML =
    '<option value="all">全部章节</option>' +
    uniqueArray([...questionModules, ...resourceModules]).map((value) => `<option value="${value}">${value}</option>`).join("");
  const studyModules = uniqueArray(questionModules);
  studyModuleSelect.innerHTML = studyModules
    .map((value) => `<option value="${value}">${formatModuleLabel(value)}</option>`)
    .join("");

  if (studyModules.includes(state.study.module)) {
    studyModuleSelect.value = state.study.module;
  } else if (studyModules.length) {
    state.study.module = studyModules[0];
    studyModuleSelect.value = studyModules[0];
  }
}

function renderResources() {
  const keyword = (searchInput.value || "").trim().toLowerCase();
  const categoryValue = categorySelect.value;
  const modeValue = modeSelect.value;
  const doctypeValue = doctypeSelect.value;
  const resourceModuleValue = resourceModuleSelect?.value || "all";

  const matched = DATA.resources.filter((item) => {
    if (categoryValue !== "all" && item.category !== categoryValue) return false;
    if (modeValue !== "all" && item.kind !== modeValue) return false;
    if (doctypeValue !== "all" && item.type !== doctypeValue) return false;
    if (resourceModuleValue !== "all" && item.module !== resourceModuleValue) return false;

    const haystack = `${item.name} ${item.module} ${item.category} ${item.kind} ${item.type} ${item.session} ${item.year}`.toLowerCase();
    return !keyword || haystack.includes(keyword);
  });

  const grouped = uniqueModules(matched);
  const groups = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));

  statsEl.textContent = `共找到 ${matched.length} 个文件，当前筛选共 ${groups.length} 个章节。`;
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

function getStudyOrder(pool, mode) {
  const list = [...pool];
  if (mode === "random") {
    for (let i = list.length - 1; i > 0; i--) {
      const swap = Math.floor(Math.random() * (i + 1));
      [list[i], list[swap]] = [list[swap], list[i]];
    }
    return list;
  }

  return list.sort((a, b) => {
    const yearA = Number(a.year) || 0;
    const yearB = Number(b.year) || 0;
    if (yearA !== yearB) {
      return yearA - yearB;
    }

    const sessionA = String(a.session || "").localeCompare(String(b.session || ""));
    if (sessionA !== 0) {
      return sessionA;
    }

    const numberA = Number.parseInt(String(a.number || "0"), 10) || 0;
    const numberB = Number.parseInt(String(b.number || "0"), 10) || 0;
    if (numberA !== numberB) {
      return numberA - numberB;
    }

    return String(a.prompt || "").localeCompare(String(b.prompt || ""));
  });
}

function getQuestionPracticeOrder(pool, mode) {
  return getStudyOrder(pool, mode);
}

function setupQuestionPracticePool() {
  const filtered = getFilteredQuestions();
  state.filteredQuestionSeed = filtered;
  state.practice.order = [];
  state.practice.pointer = -1;
  state.practice.mode = "sequence";
  questionStatsEl.textContent = `当前可用 ${filtered.length} 道题`;
  questionSeqBtn.disabled = !filtered.length;
  questionRandomBtn.disabled = !filtered.length;
  questionPrevBtn.disabled = !filtered.length;
  questionNextBtn.disabled = !filtered.length;
  return filtered;
}

function setQuestionPracticeByPointer(pointer, options = {}) {
  if (!practiceCard || !state.practice.order.length) {
    return;
  }

  const total = state.practice.order.length;
  const safePointer = ((pointer % total) + total) % total;
  state.practice.pointer = safePointer;
  const question = state.practice.order[safePointer];

  const title = document.createElement("div");
  title.className = "question-practice-title";
  title.textContent = state.practice.mode === "random" ? "随机练习中" : "顺序练习中";

  const node = createQuestionNode(question);
  node.classList.add("practice-active");

  practiceCard.classList.remove("hidden");
  practiceCard.innerHTML = "";
  practiceCard.appendChild(title);
  practiceCard.appendChild(node);

  questionStatsEl.textContent = `练习进度 ${safePointer + 1}/${total}`;

  if (!options.silent) {
    practiceCard.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function startQuestionPractice(mode = "sequence") {
  const pool = setupQuestionPracticePool();
  if (!pool.length) {
    practiceCard.classList.add("hidden");
    practiceCard.innerHTML = "";
    questionStatsEl.textContent = `当前暂无可练习题目`;
    return;
  }

  state.practice.mode = mode;
  state.practice.order = getQuestionPracticeOrder(pool, mode);
  const startIndex = 0;
  setQuestionPracticeByPointer(startIndex);
}

function nextQuestionPractice() {
  if (!state.practice.order.length) {
    return;
  }
  if (state.practice.order.length <= 1) {
    return;
  }
  const next = state.practice.pointer + 1;
  setQuestionPracticeByPointer(next);
}

function prevQuestionPractice() {
  if (!state.practice.order.length) {
    return;
  }
  if (state.practice.order.length <= 1) {
    return;
  }
  const prev = state.practice.pointer - 1;
  setQuestionPracticeByPointer(prev);
}

function renderStudySummary(module, pool) {
  const insights = gatherStudyInsights(pool);
  const hasData = Boolean(pool && pool.length);
  if (!hasData) {
    studySummary.innerHTML = `<div class="empty">该章节暂无可学习题目。</div>`;
    return;
  }

  const sectionText = state.study.section && state.study.section !== "all" ? `（当前场次：${getQuestionSectionLabel({ groupKey: state.study.section })}）` : "（全部场次）";

  const yearRows = insights.byYear
    .map((item) => `${item.year || "未标注"}: ${item.count}题`)
    .join(" / ");
  const sessionRows = insights.bySession
    .map((item) => `${item.session}: ${item.count}题`)
    .join(" / ");
  const keywordRows = insights.topKeywords.length
    ? insights.topKeywords.map((keyword) => `<span class="chip">${keyword}</span>`).join("")
    : "<span class=\"chip\">尚未识别到稳定关键词，建议直接按题目顺序学习</span>";

  studySummary.innerHTML = `
    <section class="study-summary-panel">
      <h3>${formatModuleLabel(module)} 学习加练习总览 ${sectionText}</h3>
      <p>已提炼 ${insights.sentenceCounts.total} 道题，${insights.sentenceCounts.withAnswer} 道有答案。</p>
      <p>年份分布：${yearRows}</p>
      <p>场次分布：${sessionRows}</p>
      <div class="chip-row">${keywordRows}</div>
    </section>
  `;
}

function setupStudyPool() {
  const module = studyModuleSelect ? studyModuleSelect.value : state.study.module;
  const answerFilter = studyAnswerFilter ? studyAnswerFilter.value : "all";
  const selectedSection = studySectionSelect ? studySectionSelect.value : "all";
  const sectionBuckets = buildSectionBuckets(module, answerFilter);

  if (studySectionSelect) {
    populateStudySectionOptions(studySectionSelect, sectionBuckets, selectedSection);
  }
  renderStudySectionPills(sectionBuckets, studySectionSelect ? studySectionSelect.value : selectedSection);

  const filtered = parseModuleQuestions(module, answerFilter).filter((question) =>
    selectedSection === "all" ? true : getQuestionSectionKey(question) === selectedSection,
  );
  state.study.module = module;
  state.study.section = selectedSection;
  state.study.pool = filtered;
  state.study.mode = "sequence";
  state.study.order = [];
  state.study.pointer = -1;
  renderStudySummary(module, filtered);
  studyStatsEl.textContent = `当前可用 ${filtered.length} 题`;
  studySeqBtn.disabled = !filtered.length;
  studyRandomBtn.disabled = !filtered.length;
  studyPrevBtn.disabled = !filtered.length;
  studyNextBtn.disabled = !filtered.length;

  return filtered;
}

function buildSectionBuckets(module, answerFilterValue = "all") {
  const pool = parseModuleQuestions(module, answerFilterValue);
  const buckets = new Map();

  for (const question of pool) {
    const key = getQuestionSectionKey(question);
    const label = getQuestionSectionLabel(question);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label,
        count: 0,
        withAnswer: 0,
      });
    }
    const bucket = buckets.get(key);
    bucket.count += 1;
    if (question.hasAnswer) {
      bucket.withAnswer += 1;
    }
  }

  return [...buckets.values()].sort((a, b) => compareSectionKey(a.key, b.key));
}

function populateStudySectionOptions(selectElement, buckets, selectedValue) {
  if (!selectElement) {
    return;
  }

  const options = [
    `<option value="all">全部场次</option>`,
    ...buckets.map((item) => `<option value="${item.key}">${item.label}（${item.count}题）</option>`),
  ];
  selectElement.innerHTML = options.join("");

  const defaultValue = selectElement.querySelector(`option[value="${selectedValue}"]`) ? selectedValue : "all";
  selectElement.value = defaultValue;
  state.study.section = defaultValue;
}

function setStudyQuestionByPointer(pointer, options = {}) {
  if (!studyQuestionPractice || !state.study.order.length) {
    return;
  }

  const total = state.study.order.length;
  const safePointer = ((pointer % total) + total) % total;
  state.study.pointer = safePointer;
  const question = state.study.order[safePointer];
  const sectionLabel = state.study.section === "all" ? "全部场次" : getQuestionSectionLabel(question);

  const node = createQuestionNode(question);
  node.classList.add("practice-active");
  studyQuestionPractice.classList.remove("hidden");
  studyQuestionPractice.innerHTML = "";
  studyQuestionPractice.appendChild(node);
  studyStatsEl.textContent = `章节 ${formatModuleLabel(state.study.module)} · ${sectionLabel} · 进度 ${safePointer + 1}/${total}`;

  if (!options.silent) {
    studyQuestionPractice.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function startStudy(mode = "sequence") {
  const pool = setupStudyPool();
  if (!pool.length) {
    studyQuestionPractice.classList.add("hidden");
    studyStatsEl.textContent = `该章节暂无可学习题目`;
    return;
  }

  state.study.mode = mode;
  state.study.order = getStudyOrder(pool, mode);
  const startIndex = mode === "random" ? 0 : 0;
  setStudyQuestionByPointer(startIndex);
  studyPrevBtn.disabled = false;
  studyNextBtn.disabled = false;
}

function goNextStudyQuestion() {
  if (!state.study.order.length) {
    return;
  }
  if (state.study.order.length <= 1) {
    return;
  }
  const next = state.study.pointer + 1;
  setStudyQuestionByPointer(next);
}

function goPrevStudyQuestion() {
  if (!state.study.order.length) {
    return;
  }
  if (state.study.order.length <= 1) {
    return;
  }
  const prev = state.study.pointer - 1;
  setStudyQuestionByPointer(prev);
}

function renderStudyMode() {
  setupStudyPool();
  studyQuestionPractice.classList.add("hidden");
  studyQuestionPractice.innerHTML = "";
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

  const body = createQuestionBody(question);

  const answerWrap = document.createElement("section");
  answerWrap.className = "answer-wrap hidden";
  answerWrap.setAttribute("aria-live", "polite");

  const answerLabel = document.createElement("p");
  answerLabel.className = "q-block-title q-answer-title";
  answerLabel.textContent = "解析 / 答案";

  const answerText = document.createElement("div");
  answerText.className = "answer-text";
  answerText.textContent = formatAnswerLine(
    question.answer || "这题暂无可显示答案，建议先看原题页。建议结合原题页中的官方答案作复盘。",
  );
  answerWrap.appendChild(answerLabel);
  answerWrap.appendChild(answerText);

  const actionRow = document.createElement("div");
  actionRow.className = "question-action-row question-toolbar";

  const reveal = document.createElement("button");
  reveal.type = "button";
  reveal.className = "btn answer-btn";
  const hasAnswer = Boolean(question.answer && String(question.answer).trim());
  reveal.textContent = hasAnswer ? "查看答案" : "暂无解析";
  reveal.setAttribute("aria-expanded", "false");
  if (!hasAnswer) {
    reveal.disabled = true;
  }

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

  if (hasAnswer) {
    reveal.addEventListener("click", () => {
      const isHidden = answerWrap.classList.toggle("hidden");
      reveal.textContent = isHidden ? "查看答案" : "隐藏答案";
      reveal.setAttribute("aria-expanded", String(!isHidden));
    });
  }

  const copyTextBtn = document.createElement("button");
  copyTextBtn.type = "button";
  copyTextBtn.className = "btn folder-btn";
  copyTextBtn.textContent = "复制题干";
  copyTextBtn.addEventListener("click", async () => {
    const payload = [
      `${String(question.module || "未分类").toUpperCase()} ${question.number || "未标注"} · ${question.year || "年份未知"} ${question.session || "场次未知"}`,
      "",
      String(question.prompt || question.full || ""),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      copyTextBtn.textContent = "已复制";
      setTimeout(() => {
        copyTextBtn.textContent = "复制题干";
      }, 900);
    } catch (error) {
      copyTextBtn.textContent = "复制失败";
      setTimeout(() => {
        copyTextBtn.textContent = "复制题干";
      }, 900);
    }
  });

  actionRow.appendChild(reveal);
  actionRow.appendChild(preview);
  actionRow.appendChild(openSource);
  actionRow.appendChild(copyTextBtn);

  item.appendChild(createQuestionHeader(question));
  item.appendChild(body);
  item.appendChild(answerWrap);
  item.appendChild(actionRow);
  return item;
}

function renderQuestions() {
  const filtered = getFilteredQuestions();
  state.filteredQuestionSeed = filtered;
  questionStatsEl.textContent = `共 ${filtered.length} 道题`;

  practiceCard.innerHTML = "";
  if (filtered.length === 0) {
    questionStatsEl.textContent = `共 0 道题`;
  }
  questionGrid.innerHTML = "";
  questionSeqBtn.disabled = !filtered.length;
  questionRandomBtn.disabled = !filtered.length;
  questionPrevBtn.disabled = !filtered.length;
  questionNextBtn.disabled = !filtered.length;

  if (!filtered.length) {
    questionGrid.innerHTML = '<div class="empty">没有找到匹配题目，请调整筛选条件。</div>';
    return;
  }

  for (const question of filtered) {
    questionGrid.appendChild(createQuestionNode(question));
  }
}

function startPracticeQuestionRandom() {
  startQuestionPractice("random");
}

function initializeViewState() {
  const hasData = Boolean(DATA.resources && DATA.resources.length) || Boolean(DATA.questions && DATA.questions.length);
  if (!hasData) {
    moduleGrid.innerHTML = '<div class="empty">未检测到数据，请先运行扫描脚本（见 scripts/build-study-index.js）。</div>';
    questionGrid.innerHTML = '<div class="empty">未检测到题库数据，请先运行扫描脚本（见 scripts/build-study-index.js）。</div>';
    renderLab();
    setTab("lab");
    return;
  }

  ensureQuestionSelectOptions();
  renderResources();
  renderQuestions();
  if (studyModuleSelect) {
    const options = Array.from(studyModuleSelect.options).map((item) => item.value);
    const defaultStudyModule = options.includes("M1") ? "M1" : options[0] || "";
    state.study.module = defaultStudyModule;
    if (defaultStudyModule) {
      studyModuleSelect.value = defaultStudyModule;
    }
  }
  renderLab();
  setTab("lab");
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
  resourceModuleSelect?.addEventListener("change", renderResources);
  studyModuleSelect?.addEventListener("change", () => {
    state.study.module = studyModuleSelect.value;
    if (studySectionSelect) {
      studySectionSelect.value = "all";
      state.study.section = "all";
    }
    renderStudyMode();
  });
  studyAnswerFilter?.addEventListener("change", renderStudyMode);
  studySectionSelect?.addEventListener("change", renderStudyMode);

  questionSeqBtn?.addEventListener("click", () => startQuestionPractice("sequence"));
  questionRandomBtn?.addEventListener("click", startPracticeQuestionRandom);
  questionPrevBtn?.addEventListener("click", prevQuestionPractice);
  questionNextBtn?.addEventListener("click", nextQuestionPractice);
  studySeqBtn?.addEventListener("click", () => startStudy("sequence"));
  studyRandomBtn?.addEventListener("click", () => startStudy("random"));
  studyPrevBtn?.addEventListener("click", goPrevStudyQuestion);
  studyNextBtn?.addEventListener("click", goNextStudyQuestion);
  labTimerToggle?.addEventListener("click", toggleLabTimer);
  labTimerReset?.addEventListener("click", () => resetLabTimer());
  labSaveNote?.addEventListener("click", saveLabNote);
  labMarkComplete?.addEventListener("click", markLabComplete);
  labInsightTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.lab.activePanel = tab.dataset.labPanel || "answer";
      renderLabInsights();
    });
  });

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
