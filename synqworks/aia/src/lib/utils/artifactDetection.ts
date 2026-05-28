/**
 * Artifact detection and extraction utilities
 * Scans assistant messages for code blocks that can be previewed
 */

import {
  Artifact,
  ArtifactLanguage,
  extractCodeBlocks,
  generateArtifactId,
  getArtifactType,
  isPreviewable,
  normalizeLanguage,
} from "../../types/artifacts";

/**
 * Detect artifacts in a message content
 */
export function detectArtifacts(
  messageId: string,
  content: string,
): Artifact[] {
  const codeBlocks = extractCodeBlocks(content);
  const artifacts: Artifact[] = [];

  codeBlocks.forEach(
    (block: { language: string; content: string }, index: number) => {
      const language = normalizeLanguage(block.language);
      const previewable = isPreviewable(block.language, block.content);

      // Only create artifacts for previewable content or significant code blocks
      if (previewable || block.content.split("\n").length > 5) {
        const artifact: Artifact = {
          id: generateArtifactId(messageId, index),
          messageId,
          type: getArtifactType(language),
          language,
          content: block.content,
          previewable,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Try to extract title from comments
        const titleMatch = block.content.match(
          /^(?:\/\/|#|\/\*|\<\!--)\s*(.+?)(?:\*\/|-->)?$/ms,
        );
        if (titleMatch) {
          artifact.title = titleMatch[1].trim();
        }

        artifacts.push(artifact);
      }
    },
  );

  return artifacts;
}

/**
 * Check if a message contains artifacts
 */
export function hasArtifacts(content: string): boolean {
  const codeBlocks = extractCodeBlocks(content);
  return codeBlocks.some((block: { language: string; content: string }) =>
    isPreviewable(block.language, block.content),
  );
}

/**
 * Get file extension for artifact language
 */
export function getFileExtension(language: ArtifactLanguage): string {
  const extensionMap: Record<ArtifactLanguage, string> = {
    html: "html",
    css: "css",
    javascript: "js",
    typescript: "ts",
    react: "jsx",
    vue: "vue",
    svelte: "svelte",
    markdown: "md",
    json: "json",
    unknown: "txt",
  };

  return extensionMap[language] || "txt";
}

/**
 * Suggest filename for artifact
 */
export function suggestFilename(artifact: Artifact): string {
  const timestamp = new Date().toISOString().split("T")[0];
  const extension = getFileExtension(artifact.language);

  if (artifact.title) {
    // Sanitize title for filename
    const safeName = artifact.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `${safeName}.${extension}`;
  }

  return `artifact-${timestamp}.${extension}`;
}

/**
 * Compare two artifacts to detect changes
 */
export function getArtifactDiff(
  oldArtifact: Artifact,
  newArtifact: Artifact,
): {
  hasChanges: boolean;
  addedLines: number;
  removedLines: number;
  changedLines: number;
} {
  if (oldArtifact.content === newArtifact.content) {
    return {
      hasChanges: false,
      addedLines: 0,
      removedLines: 0,
      changedLines: 0,
    };
  }

  const oldLines = oldArtifact.content.split("\n");
  const newLines = newArtifact.content.split("\n");

  // Simple line-based diff
  let addedLines = 0;
  let removedLines = 0;
  let changedLines = 0;

  const maxLength = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLength; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined) {
      addedLines++;
    } else if (newLine === undefined) {
      removedLines++;
    } else if (oldLine !== newLine) {
      changedLines++;
    }
  }

  return {
    hasChanges: true,
    addedLines,
    removedLines,
    changedLines,
  };
}
