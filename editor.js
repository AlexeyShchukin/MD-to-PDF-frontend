import { defaultOptions, generateCSS } from "./settings.js";

const pendingLangLoads = new Set();

function getPrismLanguage(lang, onLoaded) {
    const requested = (lang || "").toLowerCase().trim() || "plaintext";

    if (!Prism.languages[requested]) {
        const loader = Prism.plugins?.autoloader?.loadLanguages;
        Prism.plugins.autoloader.languages_path =
            "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/";

        if (loader && !pendingLangLoads.has(requested)) {
            pendingLangLoads.add(requested);
            try {
                loader([requested], () => {
                    pendingLangLoads.delete(requested);
                    onLoaded?.(requested);
                });
            } catch (e) {
                pendingLangLoads.delete(requested);
            }
        }
    }

    if (Prism.languages[requested]) return requested;
    return "plaintext";
}

marked.setOptions({
    highlight(code, lang) {
        const safeLang = getPrismLanguage(lang);
        const highlighted = Prism.highlight(
            code,
            Prism.languages[safeLang] || Prism.languages.plaintext,
            safeLang
        );
        return `<pre class="language-${safeLang}"><code class="language-${safeLang}">${highlighted}</code></pre>`;
    },
    breaks: true,
    gfm: true
});

function normalizeHex(value) {
    if (!value) return "";
    const stripped = String(value).trim().replace(/^#/, "");
    const cleaned = stripped.replace(/[^0-9a-fA-F]/g, "");
    if (cleaned.length === 3 || cleaned.length === 6) {
        return `#${cleaned.toUpperCase()}`;
    }
    return value;
}

function syncColorInputs(name, value, skipEl) {
    document.querySelectorAll(`.style-setting[data-name="${name}"]`).forEach(el => {
        if (el === skipEl) return;
        if (el.type === "color" || el.classList.contains("color-hex")) {
            el.value = value;
        }
    });
}

const easyMDE = new EasyMDE({
    element: document.getElementById("editor"),
    spellChecker: false,
    autosave: { enabled: false },
    tabSize: 4,
    indentUnit: 4,
    toolbar: [
        "bold", "italic", "heading", "|",
        "quote", "code", "link", "image",
        "unordered-list", "ordered-list", "table",
        "horizontal-rule", "undo", "redo", "guide"
    ]
});

const preview = document.getElementById("preview");
const previewPanel = document.querySelector(".preview-panel");
const settingsDrawer = document.getElementById("settingsDrawer");
const toggleSettings = document.getElementById("toggleSettings");
const closeSettings = document.getElementById("closeSettings");
const fileInput = document.getElementById("mdFileInput");
const openFilePicker = document.getElementById("openFilePicker");
const mdUrlInput = document.getElementById("mdUrlInput");
const loadUrlButton = document.getElementById("loadUrl");
const dropZone = document.getElementById("dropZone");
let editorPlaceholder;

let styleOptions = { ...defaultOptions };
let lastRenderedHtml = "";
let codeBlockMarks = [];
let previewInitialized = false;

function loadMdContent(text) {
    if (typeof text !== "string" || !text.length) return;
    easyMDE.value(text);
    handleEditorChange();
    updateEditorPlaceholder();
}

function isAllowedFile(file) {
    if (!file) return false;
    const type = (file.type || "").toLowerCase();
    const name = (file.name || "").toLowerCase();
    const allowedExt = [".md", ".markdown", ".mdown", ".txt"];

    const hasAllowedExt = allowedExt.some(ext => name.endsWith(ext));
    const isTextType = type.startsWith("text/") || type === "text/markdown" || type === "text/plain";

    return hasAllowedExt || isTextType;
}

function normalizeMdUrl(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        // Convert GitHub blob links to raw to avoid CORS/blockers
        if (host === "github.com" || host === "www.github.com") {
            if (parsed.pathname.includes("/blob/")) {
                parsed.hostname = "raw.githubusercontent.com";
                parsed.pathname = parsed.pathname.replace("/blob/", "/");
                return parsed.toString();
            }
        }
        return parsed.toString();
    } catch {
        return url;
    }
}

function readFile(file) {
    if (!file) return;
    if (!isAllowedFile(file)) {
        alert("Only text or Markdown files can be uploaded (.md, .markdown, .txt).");
        return;
    }
    const reader = new FileReader();
    reader.onload = e => loadMdContent(e.target?.result || "");
    reader.readAsText(file);
}

function updateEditorPlaceholder() {
    if (!editorPlaceholder) return;
    const hasText = Boolean((easyMDE.value() || "").length);
    editorPlaceholder.classList.toggle("hidden", hasText);
}

function wireImportControls() {
    if (fileInput) {
        fileInput.addEventListener("change", e => {
            const file = e.target.files?.[0];
            readFile(file);
            e.target.value = "";
        });
    }

    if (openFilePicker && fileInput) {
        openFilePicker.addEventListener("click", () => {
            fileInput.click();
        });
    }

    if (loadUrlButton && mdUrlInput) {
        loadUrlButton.addEventListener("click", async () => {
            const url = (mdUrlInput.value || "").trim();
            if (!url) return;
            const normalizedUrl = normalizeMdUrl(url);
            try {
                const res = await fetch(normalizedUrl);
                const text = await res.text();
                loadMdContent(text);
            } catch (err) {
                console.error("Failed to load URL", err);
                alert("Не удалось загрузить файл по ссылке. Попробуйте raw-ссылку (raw.githubusercontent.com) или другой источник.");
            }
        });
    }

    const cmWrapper = easyMDE?.codemirror?.getWrapperElement();
    if (cmWrapper) {
        editorPlaceholder = document.createElement("div");
        editorPlaceholder.className = "editor-placeholder";
        editorPlaceholder.textContent = "Enter a text or drop .md file here";
        cmWrapper.appendChild(editorPlaceholder);
        updateEditorPlaceholder();

        ["dragenter", "dragover"].forEach(evt => {
            cmWrapper.addEventListener(evt, e => {
                e.preventDefault();
                e.stopPropagation();
                cmWrapper.classList.add("dragover");
            });
        });
        ["dragleave", "drop"].forEach(evt => {
            cmWrapper.addEventListener(evt, e => {
                e.preventDefault();
                e.stopPropagation();
                if (evt === "dragleave") {
                    cmWrapper.classList.remove("dragover");
                    return;
                }
                cmWrapper.classList.remove("dragover");
                const file = e.dataTransfer?.files?.[0];
                if (file) {
                    readFile(file);
                }
            });
        });
    }
}

function getPreviewScroll() {
    const doc = preview.contentDocument;
    if (!doc) return { top: 0, left: 0 };

    const el = doc.scrollingElement || doc.documentElement || doc.body;
    return {
        top: el?.scrollTop || 0,
        left: el?.scrollLeft || 0
    };
}

function restorePreviewScroll(pos) {
    const doc = preview.contentDocument;
    if (!doc) return;

    const el = doc.scrollingElement || doc.documentElement || doc.body;
    if (!el) return;

    el.scrollTo(pos.left ?? 0, pos.top ?? 0);
}

function clearCodeBlockMarks() {
    codeBlockMarks.forEach(mark => mark.clear());
    codeBlockMarks = [];
}

function tokenLength(token) {
    if (typeof token === "string") return token.length;
    if (Array.isArray(token.content)) {
        return token.content.reduce((sum, t) => sum + tokenLength(t), 0);
    }
    return tokenLength(token.content || "");
}

function highlightLineTokens(cm, lineNumber, tokens) {
    let ch = 0;
    tokens.forEach(tok => {
        if (typeof tok === "string") {
            ch += tok.length;
            return;
        }

        const len = tokenLength(tok);
        if (len > 0 && tok.type) {
            const from = { line: lineNumber, ch };
            const to = { line: lineNumber, ch: ch + len };
            const className = `cm-prism-${tok.type}`;
            codeBlockMarks.push(cm.markText(from, to, { className }));
        }

        ch += len;
    });
}

function highlightCodeBlocksInEditor() {
    const cm = easyMDE.codemirror;
    clearCodeBlockMarks();

    const total = cm.lineCount();
    let line = 0;

    while (line < total) {
        const text = cm.getLine(line) || "";
        const fenceMatch = text.match(/^```(\w+)?/);

        if (!fenceMatch) {
            line += 1;
            continue;
        }

        const lang = getPrismLanguage(fenceMatch[1] || "plaintext", () => {
            highlightCodeBlocksInEditor();
        });
        if (!Prism.languages[lang]) {
            line += 1;
            continue;
        }

        // Color the language hint right on the fence line
        if (fenceMatch[1]) {
            const langStart = fenceMatch[0].length - fenceMatch[1].length;
            const from = { line, ch: langStart };
            const to = { line, ch: langStart + fenceMatch[1].length };
            codeBlockMarks.push(cm.markText(from, to, { className: "cm-prism-lang" }));
        }

        let end = line + 1;
        while (end < total && !(cm.getLine(end) || "").startsWith("```")) {
            end += 1;
        }

        const endLine = Math.min(end, total);
        for (let ln = line + 1; ln < endLine; ln++) {
            const codeLine = cm.getLine(ln) || "";
            const tokens = Prism.tokenize(
                codeLine,
                Prism.languages[lang] || Prism.languages.plaintext || Prism.languages.none
            );
            highlightLineTokens(cm, ln, tokens);
        }

        line = endLine + 1; // skip closing fence
    }
}

function parseInputValue(input) {
    const type = input.dataset.type || input.type;
    if (type === "number" || type === "range") {
        return parseFloat(input.value);
    }
    if (type === "checkbox") {
        return input.checked;
    }
    return input.value;
}

function updatePreview() {
    const md = easyMDE.value();
    const htmlContent = marked.parse(md).replace(/<pre><code>/g, '<pre class="language-none"><code class="language-none">');
    const customCSS = generateCSS(styleOptions);
    const inlinePad = Math.max(styleOptions.codePadding - 1, 0);
    const fontImports = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600&family=Space+Grotesk:wght@400;600&family=Merriweather:wght@400;700&family=Inter:wght@400;600&family=Source+Serif+4:wght@400;700&family=IBM+Plex+Sans:wght@400;600&family=Fira+Code:wght@400;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  ${fontImports}
  <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
  <style id="dynamicStyles">
    ${customCSS}
    body { width: 794px; max-width: 794px; min-height: 1123px; margin: 0 auto; color: #111827; }
    :not(pre) > code {
        background: ${styleOptions.codeBackground};
        color: ${styleOptions.codeColor};
        padding: ${inlinePad}px ${styleOptions.codePadding}px;
        border-radius: ${styleOptions.codeBorderRadius}px;
    }
    pre[class*="language-"] code {
        padding: 0 !important;
        background: transparent;
        text-indent: 0;
    }
    pre.language-none, pre.language-none code {
        background: ${styleOptions.preBackground};
        color: #e5e7eb;
        font-family: ${styleOptions.codeFont};
        border-radius: ${styleOptions.preBorderRadius}px;
        margin: ${styleOptions.preMargin}px 0;
    }
    img { display: block; margin: ${Math.max(styleOptions.bodyPadding / 2, 8)}px 0; }
    hr {
        border: 0;
        border-top: 2px solid #d1d5db;
        margin: 16px 0;
    }
  </style>
</head>
<body>
  ${htmlContent}
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
  <script>
    Prism.plugins.autoloader.languages_path = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/";
    Prism.highlightAll();
  </script>
</body>
</html>
`;

    lastRenderedHtml = html;
    const doc = preview.contentDocument;
    if (previewInitialized && doc?.body) {
        const scrollPos = getPreviewScroll();
        const styleTag = doc.getElementById("dynamicStyles");
        if (styleTag) {
            styleTag.textContent = `
${customCSS}
body { width: 794px; max-width: 794px; min-height: 1123px; margin: 0 auto; color: #111827; }
:not(pre) > code {
    background: ${styleOptions.codeBackground};
    color: ${styleOptions.codeColor};
    padding: ${inlinePad}px ${styleOptions.codePadding}px;
    border-radius: ${styleOptions.codeBorderRadius}px;
}
pre[class*="language-"] code {
    padding: 0 !important;
    background: transparent;
    text-indent: 0;
}
pre.language-none, pre.language-none code {
    background: ${styleOptions.preBackground};
    color: #e5e7eb;
    font-family: ${styleOptions.codeFont};
    border-radius: ${styleOptions.preBorderRadius}px;
    margin: ${styleOptions.preMargin}px 0;
}
img { display: block; margin: ${Math.max(styleOptions.bodyPadding / 2, 8)}px 0; }
hr {
    border: 0;
    border-top: 2px solid #d1d5db;
    margin: 16px 0;
}
`;
        }
        const bodyEl = doc.getElementById("previewBody") || doc.body;
        bodyEl.innerHTML = htmlContent;
        if (window.Prism?.highlightAllUnder) {
            window.Prism.highlightAllUnder(doc);
        } else if (doc.defaultView?.Prism?.highlightAllUnder) {
            doc.defaultView.Prism.highlightAllUnder(doc);
        }
        restorePreviewScroll(scrollPos);
    } else {
        preview.onload = () => {
            previewInitialized = true;
            const innerDoc = preview.contentDocument;
            if (!innerDoc) return;
            const bodyEl = innerDoc.getElementById("previewBody") || innerDoc.body;
            bodyEl.innerHTML = htmlContent;
            if (innerDoc.defaultView?.Prism?.highlightAllUnder) {
                innerDoc.defaultView.Prism.highlightAllUnder(innerDoc);
            }
        };
        preview.srcdoc = html.replace("<body>", '<body id="previewBody">');
    }
}

function hydrateSettings() {
    document.querySelectorAll(".style-setting").forEach(input => {
        const name = input.dataset.name;
        if (!name) return;

        const defaultValue = defaultOptions[name];
        if (defaultValue !== undefined) {
            if (input.type === "checkbox") {
                input.checked = Boolean(defaultValue);
            } else {
                input.value = defaultValue;
                if (input.type === "color" || input.classList.contains("color-hex")) {
                    syncColorInputs(name, defaultValue, input);
                }
            }
        }

        const handler = () => {
            let value = parseInputValue(input);
            if (input.type === "color" || input.classList.contains("color-hex")) {
                value = normalizeHex(value);
                if (value) {
                    input.value = value;
                    syncColorInputs(name, value, input);
                }
            }
            styleOptions[name] = value;
            updatePreview();
        };

        input.addEventListener("input", handler);
        input.addEventListener("change", handler);
    });
}

function handleEditorChange() {
    updatePreview();
    highlightCodeBlocksInEditor();
    updateEditorPlaceholder();
}

function alignSettingsDrawer() {
    if (!settingsDrawer.classList.contains("open")) return;
    const rect = previewPanel?.getBoundingClientRect();
    if (!rect) return;
    const top = Math.max(0, rect.top);
    settingsDrawer.style.top = `${top}px`;
}

function setSettingsOpen(isOpen) {
    settingsDrawer.classList.toggle("open", isOpen);
    document.body.classList.toggle("settings-open", isOpen);
    if (isOpen) {
        alignSettingsDrawer();
    } else {
        settingsDrawer.style.top = "";
    }
}

hydrateSettings();
easyMDE.codemirror.on("change", handleEditorChange);
handleEditorChange();
wireImportControls();

document.getElementById("savePdf").addEventListener("click", async () => {
    const html = lastRenderedHtml || preview.srcdoc;
    if (!html) return;
    const res = await fetch("http://localhost:8000/api/v1/md-to-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ md: html })
    });

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document.pdf";
    a.click();
});

toggleSettings.addEventListener("click", () => {
    const isOpen = settingsDrawer.classList.contains("open");
    setSettingsOpen(!isOpen);
});

closeSettings.addEventListener("click", () => {
    setSettingsOpen(false);
});

window.addEventListener("resize", alignSettingsDrawer);
window.addEventListener("scroll", alignSettingsDrawer, { passive: true });
