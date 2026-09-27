# AI Page Summarizer

一个 Chrome Manifest V3 浏览器插件，可以提取任意网页的核心内容，交给任意 OpenAI 兼容的 AI 服务总结，并导出 Markdown 或 PDF。

## 功能

- 自动识别正文、标题层级、链接和图片 alt 信息
- 支持优先总结当前选中文本
- 跨语言页面处理，默认按页面主要语言输出；混合语言时使用中文
- 生成结构化 Markdown
- 一键复制、下载 `.md`，或打开排版好的报告页并调起系统打印为 PDF

## 安装

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本目录

## 配置 AI

点击插件弹窗右上角的齿轮，填写：

- **API 地址**：OpenAI 兼容服务地址，例如 `https://api.openai.com/v1`
- **模型**：按你的服务商填写，例如 `gpt-4o-mini`
- **API Key**：本地服务可不填，云端服务必填

本地 Ollama 示例：

```bash
OLLAMA_ORIGINS=chrome-extension://* ollama serve
```

默认不预置任何 API 地址。设置页会自动把基础地址补全为 `/v1/chat/completions`。

## 隐私

API Key 保存在本机 `chrome.storage.local` 中。点击总结时，会把提取到的页面文本、标题、链接等上下文发送到你配置的 AI 服务；除该服务外，本插件不包含统计或上报代码。
