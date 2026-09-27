const DEFAULTS = {
  endpoint: "https://ap-gateway.intra.weibo.com/openai/v1/chat/completions",
  model: "gpt-4o-mini",
  apiKey: ""
};

const el = (id) => document.getElementById(id);
let currentMarkdown = "";
let currentMode = "brief";

const MODES = {
  brief: {
    label: "快速摘要",
    system: "你是跨语言信息压缩专家。输出必须精炼、可扫读、不编造。输出语言与页面主要语言一致；混合语言时用中文。",
    prompt: `请生成快速阅读摘要，Markdown 输出：\n## 一句话结论\n## 30 秒读懂\n- 最多 3 个要点\n## 关键信息\n## 我需要进一步行动吗`
  },
  insight: {
    label: "深度洞察",
    system: "你是资深研究分析师。擅长从网页中提取显性信息、隐含立场、价值判断和风险。不编造，不确定处标注“未说明”。输出语言与页面主要语言一致；混合语言时用中文。",
    prompt: `请输出深度洞察笔记：\n## 核心命题\n## 关键论据\n| 论据 | 原文依据 | 强度 |\n|---|---|---|\n## 隐含立场\n## 未被回答的问题\n## 对读者的启发`
  },
  research: {
    label: "研究笔记",
    system: "你是学术与技术文献阅读助手。严格区分事实、观点、方法和局限。输出语言与页面主要语言一致；混合语言时用中文。",
    prompt: `请整理为研究笔记：\n## 研究对象\n## 问题定义\n## 方法/论证路径\n## 关键证据\n## 局限与未验证点\n## 后续可研究方向`
  },
  risk: {
    label: "可信度审查",
    system: "你是信息可信度审查专家。只基于页面文本判断，不凭空定罪。输出语言与页面主要语言一致；混合语言时用中文。",
    prompt: `请审查这个页面的可信度：\n## 可信度评级\n高 / 中 / 低，并说明理由\n## 事实与观点拆分\n| 内容 | 类型 | 依据 |\n|---|---|---|\n## 可能缺失的信息\n## 情绪化或营销语言\n## 交叉验证建议`
  },
  business: {
    label: "商业情报",
    system: "你是竞争情报和商业分析师。擅长识别产品、市场、定价、组织与战略信号。不编造。输出语言与页面主要语言一致；混合语言时用中文。",
    prompt: `请输出商业情报摘要：\n## 公司/产品定位\n## 产品与能力变化\n## 定价与商业模式信号\n## 目标用户与市场策略\n## 竞争威胁与机会\n## 建议跟踪项`
  },
  decision: {
    label: "决策辅助",
    system: "你是决策教练。帮助用户把页面信息转化为可执行判断，但不替用户承担决策责任。输出语言与页面主要语言一致；混合语言时用中文。",
    prompt: `请输出决策辅助笔记：\n## 这个页面想让我相信什么\n## 关键收益\n## 主要风险/成本\n## 适用条件\n## 如果继续，我下一步应该验证什么\n## 建议`
  }
};

function setStatus(text, isError = false) {
  el("status").textContent = text;
  el("status").style.color = isError ? "#ff8080" : "#93a3b8";
}

function renderMarkdown(markdown) {
  el("summary").innerHTML = renderMarkdownToHtml(markdown);
}

async function loadSettings() {
  const values = await chrome.storage.local.get(DEFAULTS);
  for (const key of Object.keys(DEFAULTS)) {
    el(key).value = values[key] || DEFAULTS[key] || "";
  }
}

async function getSettings() {
  const values = await chrome.storage.local.get(DEFAULTS);
  return {
    endpoint: values.endpoint || DEFAULTS.endpoint,
    model: values.model || DEFAULTS.model,
    apiKey: values.apiKey || ""
  };
}

async function extractActivePage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("没有找到当前标签页。");
  if (!/^https?:/.test(tab.url || "")) throw new Error("请在一个普通网页上使用。");

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["extractor.js"]
  });

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.extractPageContent()
  });

  if (!result?.result) throw new Error("无法提取页面内容。");
  return result.result;
}

function buildPrompt(page) {
  const context = {
    title: page.title,
    url: page.url,
    language: page.lang,
    description: page.description,
    author: page.author,
    outline: page.headings,
    keyLinks: page.links.slice(0, 50),
    imageTexts: page.images.map((x) => x.alt).filter(Boolean).slice(0, 30),
    content: page.bodyText.slice(0, 60000)
  };

  return [
    { role: "system", content: MODES[currentMode].system },
    { role: "user", content: `${MODES[currentMode].prompt}\n\n页面 JSON 数据：\n${JSON.stringify(context)}` }
  ];
}

async function callAI(messages) {
  const settings = await getSettings();
  if (!settings.apiKey) {
    throw new Error("请先点击右上角“⚙ 设置”，填写 API Key；保存一次后以后会自动读取。");
  }
  const response = await chrome.runtime.sendMessage({
    type: "ai:chat",
    ...settings,
    messages
  });
  if (!response?.ok) throw new Error(response?.error || "AI 请求失败。");
  return response.content.trim();
}

function filename(title, ext) {
  const safe = (title || "page-summary")
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${safe}.${ext}`;
}

async function summarize() {
  if (el("summarize").disabled) return;
  el("summarize").disabled = true;
  currentMarkdown = "";
  for (const id of ["copy", "download", "pdf", "history"]) el(id).disabled = true;
  setStatus("正在提取页面内容...");

  try {
    const page = await extractActivePage();
    setStatus(`已提取 ${page.bodyText.length} 字符，正在 AI 总结...`);
    const summary = await callAI(buildPrompt(page));
    currentMarkdown = `# ${page.title}\n\n> 模式：${MODES[currentMode].label}\n> 来源：${page.url}\n> 提取时间：${new Date().toLocaleString()}\n\n${summary}\n`;
    renderMarkdown(summary);
    await saveHistory({
      id: crypto.randomUUID(),
      title: page.title,
      url: page.url,
      mode: MODES[currentMode].label,
      markdown: currentMarkdown,
      createdAt: Date.now()
    });
    setStatus("总结完成。");
    for (const id of ["copy", "download", "pdf", "history"]) el(id).disabled = false;
  } catch (error) {
    setStatus(error.message || String(error), true);
  } finally {
    el("summarize").disabled = false;
  }
}

async function saveHistory(item) {
  const { history = [] } = await chrome.storage.local.get("history");
  const next = [item, ...history].slice(0, 100);
  await chrome.storage.local.set({ history: next });
}

el("settings-toggle").onclick = () => chrome.runtime.openOptionsPage();

el("summarize").onclick = summarize;

for (const button of document.querySelectorAll(".mode")) {
  button.onclick = () => {
    document.querySelector(".mode.active")?.classList.remove("active");
    button.classList.add("active");
    currentMode = button.dataset.mode;
  };
}

el("copy").onclick = async () => {
  await navigator.clipboard.writeText(currentMarkdown);
  setStatus("已复制 Markdown。");
};

el("download").onclick = async () => {
  const title = currentMarkdown.match(/^# (.+)$/m)?.[1] || "page-summary";
  const blob = new Blob([currentMarkdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename: filename(title, "md") }).catch(async () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename(title, "md");
    a.click();
  });
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

el("pdf").onclick = async () => {
  await chrome.storage.local.set({ lastReport: currentMarkdown });
  const page = await chrome.tabs.create({ url: chrome.runtime.getURL("report.html") });
};

el("history").onclick = async () => {
  const { history = [] } = await chrome.storage.local.get("history");
  if (!history.length) {
    setStatus("暂无历史记录。");
    return;
  }
  const items = history.map((item, index) => `${index + 1}. ${item.title}｜${item.mode}｜${new Date(item.createdAt).toLocaleString()}`);
  const choice = window.prompt(`请输入编号打开历史总结：\n${items.join("\n")}`, "1");
  const index = Number(choice) - 1;
  if (history[index]) {
    currentMarkdown = history[index].markdown;
    renderMarkdown(currentMarkdown.replace(/^# .+$/m, "").replace(/^> .*$/gm, "").trim());
    setStatus(`已打开：${history[index].title}`);
    for (const id of ["copy", "download", "pdf"]) el(id).disabled = false;
  }
};

loadSettings();
