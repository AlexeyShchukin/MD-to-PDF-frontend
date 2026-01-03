import { defaultOptions, generateCSS } from "./settings.js?v=2";

const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const isStagingFrontend = window.location.pathname.startsWith("/staging");

const API_BASE = isLocalhost
  ? "http://localhost:8000"
  : isStagingFrontend
    ? "https://md2pdf-api-staging.fly.dev"
    : "https://api.md2pdf.dev";
const STATIC_BASE_URL = `${API_BASE}/static/`;
const JOB_STATUS_POLL_MS = 750;
const JOB_TIMEOUT_MS = 30000;
//const TURNSTILE_SITEKEY = window.TURNSTILE_SITEKEY || "";

// Встроенная тема подсветки для css_override (копия vendor/prism-tomorrow.min.css)
const PRISM_THEME_CSS = `code[class*=language-],pre[class*=language-]{color:#ccc;background:none;text-shadow:0 1px rgba(0,0,0,.3);font-family:Consolas,Monaco,'Andale Mono','Ubuntu Mono',monospace;font-size:1em;text-align:left;white-space:pre;word-spacing:normal;word-break:normal;word-wrap:normal;line-height:1.5;-moz-tab-size:4;-o-tab-size:4;tab-size:4;-webkit-hyphens:none;-moz-hyphens:none;-ms-hyphens:none;hyphens:none}pre[class*=language-]{padding:1em;margin:.5em 0;overflow:auto;border-radius:.3em}:not(pre)>code[class*=language-],pre[class*=language-]{background:#2d2d2d}:not(pre)>code[class*=language-]{padding:.1em;border-radius:.3em;white-space:normal}.token.comment,.token.block-comment,.token.prolog,.token.doctype,.token.cdata{color:#999}.token.punctuation{color:#ccc}.token.tag,.token.attr-name,.token.namespace,.token.deleted{color:#e2777a}.token.function-name{color:#6196cc}.token.boolean,.token.number,.token.function{color:#f08d49}.token.property,.token.class-name,.token.constant,.token.symbol{color:#f8c555}.token.selector,.token.important,.token.atrule,.token.keyword,.token.builtin{color:#cc99cd}.token.string,.token.char,.token.attr-value,.token.regex,.token.variable{color:#7ec699}.token.operator,.token.entity,.token.url{color:#67cdcc}.token.important,.token.bold{font-weight:700}.token.italic{font-style:italic}.token.entity{cursor:help}.token.inserted{color:green}`;

const languageAliases = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    sh: "bash",
    shell: "bash",
    zsh: "bash",
    html: "markup",
    xml: "markup",
    md: "markdown",
    markdown: "markdown",
    yml: "yaml",
    json5: "json",
    txt: "plaintext",
    text: "plaintext",
    plain: "plaintext",
    cplusplus: "cpp",
    "c++": "cpp"
};

function getPrismLanguage(lang) {
    const requested = (lang || "").toLowerCase().trim();
    const normalized = languageAliases[requested] || requested || "plaintext";
    if (Prism.languages[normalized]) return normalized;
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
const saveButton = document.getElementById("savePdf");
let editorPlaceholder;

let styleOptions = { ...defaultOptions };
let lastRenderedHtml = "";
let codeBlockMarks = [];
let previewInitialized = false;
//let turnstileWidgetId = null;
//let turnstileReadyPromise = null;
//let turnstileInFlight = null;

function buildPreviewCss(options) {
    const customCSS = generateCSS(options);
    const inlinePad = Math.max(options.codePadding - 1, 0);
    return `
${customCSS}
body { width: 794px; max-width: 794px; min-height: 1123px; margin: 0 auto; color: #111827; }
:not(pre) > code {
    background: ${options.codeBackground};
    color: ${options.codeColor};
    padding: ${inlinePad}px ${options.codePadding}px;
    border-radius: ${options.codeBorderRadius}px;
}
pre[class*="language-"] code {
    padding: 0 !important;
    background: transparent;
    text-indent: 0;
}
pre.language-none, pre.language-none code {
    background: ${options.preBackground};
    color: #e5e7eb;
    font-family: ${options.codeFont};
    border-radius: ${options.preBorderRadius}px;
    margin: ${options.preMargin}px 0;
}
img { display: block; margin: ${Math.max(options.bodyPadding / 2, 8)}px 0; }
hr {
    border: 0;
    border-top: 2px solid #d1d5db;
    margin: 16px 0;
}
`;
}

function buildCssOverride(options) {
    return `${PRISM_THEME_CSS}
${buildPreviewCss(options)}`;
}

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

function getMarkdownUrlFromLocation() { // ✅
    const params = new URLSearchParams(window.location.search);
    const direct = params.get("url");
    if (direct) return direct;

    if (window.location.hash) {
        const hash = window.location.hash.replace(/^#\/?/, "");
        const queryIndex = hash.indexOf("?");
        if (queryIndex !== -1) {
            const hashParams = new URLSearchParams(hash.slice(queryIndex + 1));
            return hashParams.get("url");
        }
    }
    return null;
}

function isAllowedMdUrl(url) {
    try {
        const parsed = new URL(url);
        const pathname = parsed.pathname.toLowerCase();
        const allowedExt = [".md", ".markdown", ".mdown", ".txt"];
        return allowedExt.some(ext => pathname.endsWith(ext));
    } catch {
        return false;
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
            if (!isAllowedMdUrl(normalizedUrl)) {
                alert("Only Markdown URLs are allowed (.md, .markdown, .mdown, .txt).");
                return;
            }
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

        const lang = getPrismLanguage(fenceMatch[1] || "plaintext");
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
    const previewCss = buildPreviewCss(styleOptions);
    const assetBase = window.location.origin;
    const prismLanguageScripts = `
  <script src="/vendor/prism.min.js"></script>
  <script>Prism.highlightAll();</script>
`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <base href="${assetBase}/" />
  <link href="/vendor/prism-tomorrow.min.css" rel="stylesheet" />
  <style id="dynamicStyles">
    ${previewCss}
  </style>
</head>
<body>
  ${htmlContent}
  ${prismLanguageScripts}
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
${previewCss}
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

//function getTurnstileContainer() {
//    let el = document.getElementById("turnstile-container");
//    if (!el) {
//        el = document.createElement("div");
//        el.id = "turnstile-container";
//        el.style.display = "none";
//        document.body.appendChild(el);
//    }
//    return el;
//}

//function waitForTurnstile(timeoutMs = 5000) {
//    if (window.turnstile) return Promise.resolve();
//    if (turnstileReadyPromise) return turnstileReadyPromise;
//    turnstileReadyPromise = new Promise((resolve, reject) => {
//        const deadline = Date.now() + timeoutMs;
//        const check = () => {
//            if (window.turnstile) {
//                resolve();
//            } else if (Date.now() > deadline) {
//                reject(new Error("Turnstile script not available"));
//            } else {
//                setTimeout(check, 50);
//            }
//        };
//        check();
//    });
//    return turnstileReadyPromise;
//}
//
//async function getTurnstileToken() {
//    if (!TURNSTILE_SITEKEY) return null;
//    if (turnstileInFlight) return turnstileInFlight;
//    await waitForTurnstile();
//
//    const container = getTurnstileContainer();
//    turnstileInFlight = new Promise((resolve, reject) => {
//        const cleanup = () => {
//            turnstileInFlight = null;
//        };
//        const handleError = (msg) => {
//            cleanup();
//            reject(new Error(msg));
//        };
//        const renderOptions = {
//            sitekey: TURNSTILE_SITEKEY,
//            size: "invisible",
//            callback: token => {
//                cleanup();
//                resolve(token);
//            },
//            "error-callback": () => handleError("Turnstile failed"),
//            "timeout-callback": () => handleError("Turnstile timed out"),
//        };
//
//        try {
//            if (!turnstileWidgetId) {
//                turnstileWidgetId = window.turnstile.render(container, renderOptions);
//            } else {
//                window.turnstile.reset(turnstileWidgetId);
//            }
//            window.turnstile.execute(turnstileWidgetId);
//        } catch (err) {
//            cleanup();
//            reject(err);
//        }
//    });
//    return turnstileInFlight;
//}

function setSaveButtonLoading(isLoading) {
    if (!saveButton) return;
    saveButton.disabled = isLoading;
    saveButton.textContent = isLoading ? "Rendering..." : "Save PDF";
}

async function enqueueRender(payload, token) {
    const headers = {
        "Content-Type": "application/json",
    };
//    if (token) headers["x-turnstile-token"] = token;

    const res = await fetch(`${API_BASE}/api/v1/md-to-pdf`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
    });
    const contentType = res.headers.get("content-type") || "";

    // API may return PDF directly (without queue).
    if (res.ok && contentType.includes("application/pdf")) {
        const blob = await res.blob();
        return { blob, jobId: null };
    }

    const data = contentType.includes("application/json") ? await res.json().catch(() => null) : null;
    if (!res.ok) {
        throw new Error(data?.detail || data?.error || "Failed to start render");
    }
    if (data?.job_id) {
        return { blob: null, jobId: data.job_id };
    }
    throw new Error("Failed to start render");
}

async function pollJobUntilReady(jobId) {
    const started = Date.now();

    while (true) {
        const res = await fetch(`${API_BASE}/api/v1/jobs/${jobId}`);
        const contentType = res.headers.get("content-type") || "";

        if (res.ok && contentType.includes("application/pdf")) {
            return await res.blob();
        }

        let data = null;
        if (contentType.includes("application/json")) {
            data = await res.json().catch(() => null);
        }

        if (!res.ok) {
            throw new Error(data?.detail || data?.error || `Failed to fetch job (${res.status})`);
        }

        const status = data?.status;
        if (status === "failed") {
            throw new Error(data?.error || "Render failed");
        }

        if (Date.now() - started > JOB_TIMEOUT_MS) {
            throw new Error("Render timed out. Please try again.");
        }

        await new Promise(resolve => setTimeout(resolve, JOB_STATUS_POLL_MS));
    }
}

hydrateSettings();
easyMDE.codemirror.on("change", handleEditorChange);
handleEditorChange();
wireImportControls();

(async function autoLoadMarkdownFromUrl() {
    const url = getMarkdownUrlFromLocation();
    if (!url) return;

    const normalizedUrl = normalizeMdUrl(url);
    if (!isAllowedMdUrl(normalizedUrl)) return;

    try {
        const res = await fetch(normalizedUrl);
        if (!res.ok) throw new Error("Fetch failed");
        const text = await res.text();
        loadMdContent(text);

        history.replaceState(null, "", "/");
    } catch (err) {
        console.error("Auto-load markdown failed", err);
        alert("Auto-load markdown failed");
    }
})();

saveButton?.addEventListener("click", async () => {
    const md = easyMDE.value() || "";
    const cssOverride = buildCssOverride(styleOptions);
    const payload = {
        md,
        css_override: cssOverride,
        base_url: STATIC_BASE_URL
    };

    setSaveButtonLoading(true);
    try {
//        const token = await getTurnstileToken();
//        const { blob: directBlob, jobId } = await enqueueRender(payload, token);
        const { blob: directBlob, jobId } = await enqueueRender(payload);
        const blob = directBlob || await pollJobUntilReady(jobId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "document.pdf";
        a.click();
    } catch (err) {
        console.error("Failed to render PDF", err);
        alert(err?.message || "Failed to render PDF. Please try again.");
    } finally {
        setSaveButtonLoading(false);
    }
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
