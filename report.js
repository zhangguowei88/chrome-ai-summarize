chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "render") {
    document.getElementById("report").textContent = message.markdown;
    window.print();
    sendResponse({ ok: true });
  }
});

async function loadReport() {
  const { lastReport } = await chrome.storage.local.get("lastReport");
  if (lastReport) {
    document.getElementById("report").innerHTML = renderMarkdownToHtml(lastReport);
    document.title = lastReport.match(/^# (.+)$/m)?.[1] || "AI Page Summary";
    window.print();
  }
}

loadReport();
