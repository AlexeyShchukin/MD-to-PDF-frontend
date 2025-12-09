export const defaultOptions = {
    bodyFont: "Barlow, sans-serif",
    bodyFontSize: 16,
    lineHeight: 1.6,
    bodyPadding: 20,
    bodyMargin: 0,
    preBackground: "#2d2d2d",
    preBorderRadius: 4,
    preMargin: 8,
    codeFont: "Menlo, 'SFMono-Regular', Consolas, 'Courier New', monospace",
    codeBackground: "#f0f0f0",
    codePadding: 4,
    codeColor: "#1f8f31",
    codeBorderRadius: 3,
    imgMaxWidth: 100,
    tableBorderCollapse: "collapse",
    tableWidth: 100,
    tableMargin: 16,
    thBorder: "1px solid #ddd",
    thPadding: 8,
    thBackgroundColor: "#f4f4f4",
    tdBorder: "1px solid #ddd",
    tdPadding: 8,
    blockquoteBorderLeft: "4px solid #ddd",
    blockquotePaddingLeft: 16,
    blockquoteMarginLeft: 0,
    blockquoteColor: "#666666",
    h1Size: 2.2,
    h1Color: "#2c3e50",
    h1MarginTop: 0,
    h1BorderBottom: "2px solid #eee",
    h1MarginBottom: 24,
    h2Size: 1.8,
    h2Color: "#34495e",
    h2MarginTop: 0,
    h2MarginBottom: 24,
    h3Size: 1.4,
    h3Color: "#455a64",
    h3MarginTop: 0,
    h3MarginBottom: 16
};


export function generateCSS(options) {
    return `
body {
    font-family: ${options.bodyFont};
    font-size: ${options.bodyFontSize}px;
    line-height: ${options.lineHeight};
    padding: ${options.bodyPadding}px;
    margin: ${options.bodyMargin}px;
}

pre {
    background: ${options.preBackground};
    border-radius: ${options.preBorderRadius}px;
    margin: ${options.preMargin}px 0;
    padding: 12px;
    color: #e5e7eb;
    font-family: ${options.codeFont};
}

pre[class*="language-"] {
    background: ${options.preBackground} !important;
    border-radius: ${options.preBorderRadius}px;
    margin: ${options.preMargin}px 0;
    padding: 12px;
    color: #e5e7eb;
    font-family: ${options.codeFont};
}

pre[class*="language-"] code {
    background: transparent;
    color: inherit;
}

code {
    font-family: ${options.codeFont};
    background: ${options.codeBackground};
    padding: ${options.codePadding}px;
    color: ${options.codeColor};
    border-radius: ${options.codeBorderRadius}px;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: anywhere;
}

img {
    max-width: ${options.imgMaxWidth}%;
}

table {
    border-collapse: ${options.tableBorderCollapse};
    width: ${options.tableWidth}%;
    margin: ${options.tableMargin}px 0;
}

th {
    border: ${options.thBorder};
    padding: ${options.thPadding}px;
    background-color: ${options.thBackgroundColor};
}

td {
    border: ${options.tdBorder};
    padding: ${options.tdPadding}px;
}

blockquote {
    border-left: ${options.blockquoteBorderLeft};
    padding-left: ${options.blockquotePaddingLeft}px;
    margin-left: ${options.blockquoteMarginLeft}px;
    color: ${options.blockquoteColor};
}

h1 {
    font-size: ${options.h1Size}em;
    color: ${options.h1Color};
    border-bottom: ${options.h1BorderBottom};
    margin: ${options.h1MarginTop}px 0 ${options.h1MarginBottom}px;
}

h2 {
    font-size: ${options.h2Size}em;
    color: ${options.h2Color};
    margin: ${options.h2MarginTop}px 0 ${options.h2MarginBottom}px;
}

h3 {
    font-size: ${options.h3Size}em;
    color: ${options.h3Color};
    margin: ${options.h3MarginTop}px 0 ${options.h3MarginBottom}px;
}
`;
}
