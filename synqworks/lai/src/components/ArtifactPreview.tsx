import { useState, useEffect, useRef } from "react";
import { Artifact, wrapCodeForPreview } from "../types/artifacts";

interface ArtifactPreviewProps {
  artifact: Artifact;
  className?: string;
  onSave?: () => void;
  onCopy?: () => void;
  onFullscreen?: () => void;
}

export default function ArtifactPreview({
  artifact,
  className = "",
  onSave,
  onCopy,
  onFullscreen,
}: ArtifactPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (artifact.previewable) {
      const wrapped = wrapCodeForPreview(artifact.content, artifact.language);
      setPreviewContent(wrapped);
    }
  }, [artifact]);

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    onCopy?.();
  };

  const handleFullscreen = () => {
    if (iframeRef.current) {
      iframeRef.current.requestFullscreen();
    }
    onFullscreen?.();
  };

  if (!artifact.previewable) {
    return (
      <div className={`artifact-preview-unavailable ${className}`}>
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
            <span className="text-xl">📄</span>
            <span className="font-semibold">
              {artifact.title || `${artifact.language.toUpperCase()} Code`}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Preview not available for this code type
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </button>
            {onSave && (
              <button
                onClick={onSave}
                className="px-3 py-1.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`artifact-preview ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 border border-purple-200 dark:border-purple-700/50 rounded-t-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {artifact.type === "web" && "🌐"}
              {artifact.type === "react" && "⚛️"}
              {artifact.type === "vue" && "💚"}
            </span>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                {artifact.title || "Live Preview"}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {artifact.language.toUpperCase()}
                {artifact.description && ` • ${artifact.description}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:bg-white/50 dark:hover:bg-black/30 rounded transition-colors"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              >
                <path d="m18 15-6-6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Preview Area */}
      {isExpanded && (
        <div className="bg-white dark:bg-gray-900 border-x border-purple-200 dark:border-purple-700/50">
          <div className="relative">
            <iframe
              ref={iframeRef}
              srcDoc={previewContent}
              sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation"
              className="w-full bg-white dark:bg-gray-900"
              style={{ height: "400px", border: "none" }}
              title="Code Preview"
            />
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              Sandboxed Preview
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 border border-t-0 border-purple-200 dark:border-purple-700/50 rounded-b-lg p-2 flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy Code
        </button>
        {onSave && (
          <button
            onClick={onSave}
            className="px-3 py-1.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save to File
          </button>
        )}
        <button
          onClick={handleFullscreen}
          className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors flex items-center gap-1.5"
          title="Fullscreen Preview"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
        <div className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          {artifact.content.split("\n").length} lines
        </div>
      </div>
    </div>
  );
}
