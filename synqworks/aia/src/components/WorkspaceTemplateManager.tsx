import React, { useState } from "react";
import { WorkspaceTemplateSelector } from "./WorkspaceTemplateSelector";
import { WorkspaceTemplateDialog } from "./WorkspaceTemplateDialog";
import type { WorkspaceTemplate } from "../lib/api/database";

interface WorkspaceTemplateManagerProps {
  onSelectTemplate?: (template: WorkspaceTemplate) => void;
  selectedTemplateId?: string;
}

export const WorkspaceTemplateManager: React.FC<
  WorkspaceTemplateManagerProps
> = ({ onSelectTemplate, selectedTemplateId }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<WorkspaceTemplate | null>(null);

  const handleCreateCustom = () => {
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  const handleSaveTemplate = (template: WorkspaceTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
    }
    // Refresh the selector by forcing a re-render or using a key prop
  };

  const handleSelectTemplate = (template: WorkspaceTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
    }
  };

  return (
    <div className="space-y-4">
      <WorkspaceTemplateSelector
        onSelectTemplate={handleSelectTemplate}
        onCreateCustom={handleCreateCustom}
        selectedTemplateId={selectedTemplateId}
      />

      <WorkspaceTemplateDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveTemplate}
        template={editingTemplate}
      />
    </div>
  );
};
