const DEFAULTS = {
  endpoint: "https://ap-gateway.intra.weibo.com/openai/v1/chat/completions",
  model: "gpt-4o-mini",
  apiKey: ""
};

const el = (id) => document.getElementById(id);
let saveTimer;

function setStatus(text) {
  el("status").textContent = text;
}

function normalizeEndpoint(value) {
  const endpoint = value.trim().replace(/\/+$/, "");
  if (!endpoint) return DEFAULTS.endpoint;
  if (endpoint.endsWith("/v1/chat/completions")) return endpoint;
  if (endpoint.endsWith("/v1")) return `${endpoint}/chat/completions`;
  return `${endpoint}/v1/chat/completions`;
}

async function saveSettings({ silent = false } = {}) {
  const values = {
    endpoint: normalizeEndpoint(el("endpoint").value),
    model: el("model").value.trim() || DEFAULTS.model,
    apiKey: el("api-key").value.trim()
  };
  await chrome.storage.local.set(values);
  el("endpoint").value = values.endpoint;
  el("model").value = values.model;
  if (!silent) setStatus("配置已保存。");
  return values;
}

function scheduleSave(key) {
  clearTimeout(saveTimer);
  setStatus("正在自动保存...");
  saveTimer = setTimeout(async () => {
    try {
      if (key === "endpoint") {
        await saveSettings();
      } else {
        await chrome.storage.local.set({ [key]: el(key).value.trim() });
        setStatus("已自动保存。");
      }
    } catch (error) {
      setStatus(`保存失败：${error.message}`);
    }
  }, 300);
}

async function load() {
  const values = await chrome.storage.local.get(DEFAULTS);
  for (const key of Object.keys(DEFAULTS)) {
    el(key).value = values[key] || DEFAULTS[key] || "";
    el(key).addEventListener("input", () => scheduleSave(key));
  }
}

el("show-key").onclick = () => {
  const input = el("api-key");
  const hidden = input.type === "password";
  input.type = hidden ? "text" : "password";
  el("show-key").textContent = hidden ? "隐藏" : "显示";
};

el("paste-key").onclick = async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      setStatus("剪贴板里没有可粘贴的 Key。");
      return;
    }
    el("api-key").value = text.trim();
    await saveSettings();
  } catch (error) {
    el("api-key").focus();
    setStatus("无法读取剪贴板，请点输入框后按 Ctrl/Command + V，再点“保存配置”。");
  }
};

el("save").onclick = async () => {
  try {
    await saveSettings();
  } catch (error) {
    setStatus(`保存失败：${error.message}`);
  }
};

el("test").onclick = async () => {
  try {
    setStatus("正在测试连接...");
    const values = await saveSettings({ silent: true });
    const response = await chrome.runtime.sendMessage({
      type: "ai:chat",
      ...values,
      messages: [{ role: "user", content: "请只回复：OK" }]
    });
    if (!response?.ok) throw new Error(response?.error || "连接失败。");
    setStatus(`连接成功，模型返回：${response.content.slice(0, 80)}`);
  } catch (error) {
    setStatus(`连接失败：${error.message}`);
  }
};

load();
