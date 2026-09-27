chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "ai:chat") {
    return;
  }

  (async () => {
    const { endpoint, apiKey, model, messages, temperature } = message;
    const authorization = apiKey ? `Bearer ${String(apiKey).trim()}` : "";
    if (/[^\x00-\xFF]/.test(authorization)) {
      throw new Error("API Key 包含非 ASCII 字符或中文标点，请检查是否复制了完整 Key（不要包含说明文字或引号）。");
    }

      const payload = {
        model,
        messages,
        stream: false
      };
      if (typeof temperature === "number") payload.temperature = temperature;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authorization ? { Authorization: authorization } : {})
        },
        body: JSON.stringify(payload)
      });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`AI service returned invalid JSON (${response.status}): ${text.slice(0, 300)}`);
    }

    if (!response.ok) {
      const detail = data?.error?.message || data?.message || text.slice(0, 500);
      throw new Error(`AI service error (${response.status}): ${detail}`);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI response did not contain a message.");
    }
    sendResponse({ ok: true, content });
  })().catch((error) => {
    sendResponse({ ok: false, error: error?.message || String(error) });
  });

  return true;
});
