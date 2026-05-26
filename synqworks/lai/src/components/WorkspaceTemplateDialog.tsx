import React, { useState, useEffect } from "react";
import { database, type WorkspaceTemplate } from "../lib/api/database";
import type { NewWorkspaceTemplate } from "../lib/api/types";
import { X, Save, AlertCircle } from "lucide-react";

interface WorkspaceTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: WorkspaceTemplate) => void;
  template?: WorkspaceTemplate | null;
}

export const WorkspaceTemplateDialog: React.FC<
  WorkspaceTemplateDialogProps
> = ({ isOpen, onClose, onSave, template }) => {
  const [formData, setFormData] = useState<NewWorkspaceTemplate>({
    name: "",
    description: "",
    category: "General",
    default_model: "gpt-4",
    default_provider: "openai",
    system_prompt: "",
    settings_json: "",
    ignore_patterns: "",
    file_extensions: "",
    context_instructions: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description || "",
        category: template.category,
        default_model: template.default_model,
        default_provider: template.default_provider,
        system_prompt: template.system_prompt || "",
        settings_json: template.settings_json || "",
        ignore_patterns: template.ignore_patterns || "",
        file_extensions: template.file_extensions || "",
        context_instructions: template.context_instructions || "",
      });
    } else {
      setFormData({
        name: "",
        description: "",
        category: "General",
        default_model: "gpt-4",
        default_provider: "openai",
        system_prompt: "",
        settings_json: "",
        ignore_patterns: "",
        file_extensions: "",
        context_instructions: "",
      });
    }
    setError(null);
  }, [template, isOpen]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError("Template name is required");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let savedTemplate: WorkspaceTemplate;
      if (template) {
        await database.workspaceTemplates.update(template.id, formData);
        savedTemplate = { ...template, ...formData, updated_at: Date.now() };
      } else {
        savedTemplate = await database.workspaceTemplates.create(formData);
      }

      onSave(savedTemplate);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
      console.error("Failed to save workspace template:", err);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    "General",
    "React",
    "Vue",
    "Angular",
    "Python",
    "Node.js",
    "Rust",
    "Go",
    "Java",
    "C++",
    "DevOps",
    "Data Science",
    "Machine Learning",
    "Mobile",
    "Desktop",
    "Game Development",
  ];

  const providers = [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "google", label: "Google" },
    { value: "ollama", label: "Ollama" },
    { value: "local", label: "Local" },
  ];

  const models = {
    openai: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
    anthropic: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
    google: ["gemini-pro", "gemini-pro-vision"],
    ollama: ["llama2", "codellama", "mistral"],
    local: ["local-model"],
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {template ? "Edit Template" : "Create Workspace Template"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-600 dark:text-red-400">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., React TypeScript"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Brief description of this template's purpose..."
              />
            </div>

            {/* AI Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Provider
                </label>
                <select
                  value={formData.default_provider}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      default_provider: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {providers.map((provider) => (
                    <option key={provider.value} value={provider.value}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Model
                </label>
                <select
                  value={formData.default_model}
                  onChange={(e) =>
                    setFormData({ ...formData, default_model: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {(
                    models[formData.default_provider as keyof typeof models] ||
                    []
                  ).map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                System Prompt
              </label>
              <textarea
                value={formData.system_prompt}
                onChange={(e) =>
                  setFormData({ ...formData, system_prompt: e.target.value })
                }
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="You are an expert [technology] developer..."
              />
            </div>

            {/* File Extensions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                File Extensions (comma-separated)
              </label>
              <input
                type="text"
                value={formData.file_extensions}
                onChange={(e) =>
                  setFormData({ ...formData, file_extensions: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="tsx,ts,jsx,js,css,json"
              />
            </div>

            {/* Ignore Patterns */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ignore Patterns (comma-separated)
              </label>
              <input
                type="text"
                value={formData.ignore_patterns}
                onChange={(e) =>
                  setFormData({ ...formData, ignore_patterns: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="node_modules,dist,build,.git"
              />
            </div>

            {/* Context Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Context Instructions
              </label>
              <textarea
                value={formData.context_instructions}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    context_instructions: e.target.value,
                  })
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Special instructions for understanding this project context..."
              />
            </div>

            {/* Settings JSON */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Additional Settings (JSON)
              </label>
              <textarea
                value={formData.settings_json}
                onChange={(e) =>
                  setFormData({ ...formData, settings_json: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                placeholder='{"temperature": 0.7, "max_tokens": 2000}'
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !formData.name.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
          >
            <Save className="h-4 w-4" />
            <span>
              {loading ? "Saving..." : template ? "Update" : "Create"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
