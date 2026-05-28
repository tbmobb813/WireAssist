/**
 * Code Artifacts - Live preview and interaction with AI-generated code
 * Similar to Claude's Artifacts feature
 */

export type ArtifactLanguage =
  | "html"
  | "css"
  | "javascript"
  | "typescript"
  | "react"
  | "vue"
  | "svelte"
  | "markdown"
  | "json"
  | "unknown";

export type ArtifactType =
  | "web" // HTML/CSS/JS that can be previewed
  | "react" // React component
  | "vue" // Vue component
  | "code" // Generic code (no preview)
  | "data"; // JSON/structured data

export interface CodeBlock {
  language: string;
  content: string;
  startLine: number;
  endLine: number;
}

export interface Artifact {
  id: string;
  messageId: string;
  type: ArtifactType;
  language: ArtifactLanguage;
  title?: string;
  description?: string;
  content: string;
  previewable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactVersion {
  artifactId: string;
  version: number;
  content: string;
  timestamp: string;
  changeDescription?: string;
}

export interface ArtifactPreviewConfig {
  sandbox: boolean; // Use sandboxed iframe
  allowScripts: boolean;
  allowStyles: boolean;
  allowExternal: boolean; // External resources (CDN, etc.)
  maxHeight?: number;
}

/**
 * Detect if a code block can be previewed
 */
export function isPreviewable(language: string, content: string): boolean {
  const previewableLanguages = [
    "html",
    "htm",
    "css",
    "javascript",
    "js",
    "jsx",
    "typescript",
    "ts",
    "tsx",
    "react",
    "vue",
    "svelte",
  ];

  const lang = language.toLowerCase().trim();

  // Check if it's a previewable language
  if (!previewableLanguages.includes(lang)) {
    return false;
  }

  // HTML content should have some structure
  if (["html", "htm"].includes(lang)) {
    return content.includes("<") && content.includes(">");
  }

  // React/JSX should have component structure
  if (["react", "jsx", "tsx"].includes(lang)) {
    return (
      content.includes("return") ||
      content.includes("function") ||
      content.includes("const")
    );
  }

  // Vue should have template structure
  if (lang === "vue") {
    return content.includes("<template>") || content.includes("template:");
  }

  return true;
}

/**
 * Normalize language identifier
 */
export function normalizeLanguage(lang: string): ArtifactLanguage {
  const normalized = lang.toLowerCase().trim();

  const languageMap: Record<string, ArtifactLanguage> = {
    html: "html",
    htm: "html",
    css: "css",
    javascript: "javascript",
    js: "javascript",
    jsx: "react",
    typescript: "typescript",
    ts: "typescript",
    tsx: "react",
    react: "react",
    vue: "vue",
    svelte: "svelte",
    markdown: "markdown",
    md: "markdown",
    json: "json",
  };

  return languageMap[normalized] || "unknown";
}

/**
 * Determine artifact type from language
 */
export function getArtifactType(language: ArtifactLanguage): ArtifactType {
  switch (language) {
    case "html":
    case "css":
    case "javascript":
      return "web";
    case "react":
      return "react";
    case "vue":
      return "vue";
    case "json":
      return "data";
    default:
      return "code";
  }
}

/**
 * Extract code blocks from markdown content
 */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: CodeBlock[] = [];
  let match;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const language = match[1] || "text";
    const content = match[2];

    // Calculate line numbers
    const beforeMatch = markdown.substring(0, match.index);
    const startLine = beforeMatch.split("\n").length;
    const endLine = startLine + content.split("\n").length - 1;

    blocks.push({
      language,
      content,
      startLine,
      endLine,
    });
  }

  return blocks;
}

/**
 * Convert standalone code into complete HTML document
 */
export function wrapCodeForPreview(
  content: string,
  language: ArtifactLanguage,
): string {
  // If it's already HTML with doctype, return as-is
  if (
    content.trim().toLowerCase().startsWith("<!doctype") ||
    content.trim().toLowerCase().startsWith("<html")
  ) {
    return content;
  }

  // For CSS, wrap in HTML with style tag
  if (language === "css") {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSS Preview</title>
  <style>
${content}
  </style>
</head>
<body>
  <div class="preview-content">
    <h1>CSS Preview</h1>
    <p>Your styles are applied to this document.</p>
  </div>
</body>
</html>`;
  }

  // For JavaScript, wrap in HTML with script tag
  if (language === "javascript") {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JavaScript Preview</title>
  <style>
    body { font-family: system-ui; padding: 20px; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
${content}
  </script>
</body>
</html>`;
  }

  // For React/JSX, we'll need a special handler (Babel transform)
  if (language === "react") {
    return wrapReactComponent(content);
  }

  // For HTML fragments, wrap in basic document
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HTML Preview</title>
  <style>
    body { font-family: system-ui; padding: 20px; }
  </style>
</head>
<body>
${content}
</body>
</html>`;
}

/**
 * Wrap React component for preview (with Babel standalone)
 */
function wrapReactComponent(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React Preview</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { font-family: system-ui; margin: 0; padding: 20px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
${content}

// Auto-render if there's a default export or a component
if (typeof App !== 'undefined') {
  ReactDOM.render(<App />, document.getElementById('root'));
}
  </script>
</body>
</html>`;
}

/**
 * Generate a unique ID for an artifact
 */
export function generateArtifactId(messageId: string, index: number): string {
  return `${messageId}-artifact-${index}`;
}
