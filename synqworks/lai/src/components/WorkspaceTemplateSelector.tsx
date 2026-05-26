import React, { useState, useEffect } from "react";
import { database, type WorkspaceTemplate } from "../lib/api/database";
import { ChevronRight, Settings, FileText, Code } from "lucide-react";

interface WorkspaceTemplateSelectorProps {
  onSelectTemplate: (template: WorkspaceTemplate) => void;
  onCreateCustom: () => void;
  selectedTemplateId?: string;
}

export const WorkspaceTemplateSelector: React.FC<
  WorkspaceTemplateSelectorProps
> = ({ onSelectTemplate, onCreateCustom, selectedTemplateId }) => {
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const [templatesData, categoriesData] = await Promise.all([
        database.workspaceTemplates.getAll(),
        database.workspaceTemplates.getCategories(),
      ]);
      setTemplates(templatesData);
      setCategories(["All", ...categoriesData]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
      console.error("Failed to load workspace templates:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates =
    selectedCategory === "All"
      ? templates
      : templates.filter((template) => template.category === selectedCategory);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "React":
      case "Frontend":
        return Code;
      case "Python":
      case "Data Science":
        return FileText;
      case "DevOps":
      case "Infrastructure":
        return Settings;
      default:
        return FileText;
    }
  };

  const getTemplateIcon = (template: WorkspaceTemplate) => {
    const IconComponent = getCategoryIcon(template.category);
    return <IconComponent className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">
          Loading templates...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={loadTemplates}
          className="mt-2 text-sm text-red-700 dark:text-red-300 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Workspace Templates
        </h3>
        <button
          onClick={onCreateCustom}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Create Custom
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              selectedCategory === category
                ? "bg-blue-500 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            onClick={() => onSelectTemplate(template)}
            className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
              selectedTemplateId === template.id
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="flex-shrink-0 text-gray-500 dark:text-gray-400">
                  {getTemplateIcon(template)}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {template.name}
                  </h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {template.category}
                    {template.is_builtin && (
                      <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        Built-in
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>

            {template.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {template.description}
              </p>
            )}

            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {template.default_provider} / {template.default_model}
              </span>
              {template.system_prompt && (
                <span className="inline-flex items-center space-x-1">
                  <FileText className="h-3 w-3" />
                  <span>System prompt</span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No templates found for "{selectedCategory}"</p>
          <button
            onClick={onCreateCustom}
            className="mt-2 text-blue-500 hover:underline"
          >
            Create the first custom template
          </button>
        </div>
      )}
    </div>
  );
};
