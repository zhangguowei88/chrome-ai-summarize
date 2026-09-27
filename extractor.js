function extractPageContent() {
  const selection = window.getSelection?.().toString().trim();
  const title = document.title || "Untitled page";
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  const description = document.querySelector('meta[name="description"]')?.content?.trim() || "";
  const author = document.querySelector('meta[name="author"]')?.content?.trim() || "";
  const lang = document.documentElement.lang || "";

  const ignored = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "SVG", "NAV", "FOOTER", "ASIDE", "FORM"]);
  const candidates = [...document.querySelectorAll("article, main, [role=main], .article, .post, .content")]
    .filter((el) => !ignored.has(el.tagName) && el.innerText?.trim())
    .sort((a, b) => b.innerText.trim().length - a.innerText.trim().length);
  const root = candidates[0] || document.body;

  const headings = [...root.querySelectorAll("h1, h2, h3, h4")]
    .filter((el) => !ignored.has(el.tagName) && el.innerText.trim())
    .slice(0, 80)
    .map((el) => `${"#".repeat(Math.min(Number(el.tagName.slice(1)), 4))} ${el.innerText.trim()}`);

  const paragraphs = [...root.querySelectorAll("p, li, td, th, blockquote, pre")]
    .filter((el) => !ignored.has(el.tagName) && el.innerText?.trim())
    .map((el) => el.innerText.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const links = [...root.querySelectorAll("a[href]")]
    .map((el) => ({
      text: el.innerText.replace(/\s+/g, " ").trim(),
      href: new URL(el.getAttribute("href"), location.href).href
    }))
    .filter((link) => link.text && link.text.length <= 160)
    .slice(0, 120);

  const images = [...root.querySelectorAll("img")]
    .filter((img) => (img.naturalWidth || img.width) >= 100 && (img.alt || img.getAttribute("aria-label")))
    .map((img) => ({
      alt: (img.alt || img.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim(),
      src: new URL(img.currentSrc || img.src, location.href).href
    }))
    .slice(0, 50);

  const bodyText = (selection || root.innerText || "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, 80000);

  return {
    url: canonical || location.href,
    title,
    description,
    author,
    lang,
    selection: Boolean(selection),
    headings,
    paragraphs: [...new Set(paragraphs)].slice(0, 1200),
    links,
    images,
    bodyText,
    extractedAt: new Date().toISOString()
  };
}
