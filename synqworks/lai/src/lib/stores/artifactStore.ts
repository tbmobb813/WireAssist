/**
 * Artifact Store - Manages code artifacts extracted from messages
 */

import { create } from "zustand";
import { Artifact } from "../../types/artifacts";
import { detectArtifacts } from "../utils/artifactDetection";

interface ArtifactState {
  // State
  artifacts: Map<string, Artifact[]>; // messageId -> artifacts
  selectedArtifact: Artifact | null;

  // Actions
  extractArtifacts: (messageId: string, content: string) => void;
  getArtifactsForMessage: (messageId: string) => Artifact[];
  selectArtifact: (artifact: Artifact | null) => void;
  updateArtifact: (artifactId: string, updates: Partial<Artifact>) => void;
  clearArtifacts: () => void;
}

export const useArtifactStore = create<ArtifactState>((set, get) => ({
  artifacts: new Map(),
  selectedArtifact: null,

  extractArtifacts: (messageId, content) => {
    const detected = detectArtifacts(messageId, content);

    if (detected.length > 0) {
      set((state) => {
        const newArtifacts = new Map(state.artifacts);
        newArtifacts.set(messageId, detected);
        return { artifacts: newArtifacts };
      });
    }
  },

  getArtifactsForMessage: (messageId) => {
    return get().artifacts.get(messageId) || [];
  },

  selectArtifact: (artifact) => {
    set({ selectedArtifact: artifact });
  },

  updateArtifact: (artifactId, updates) => {
    set((state) => {
      const newArtifacts = new Map(state.artifacts);

      // Find and update the artifact
      for (const [messageId, artifacts] of newArtifacts.entries()) {
        const index = artifacts.findIndex((a) => a.id === artifactId);
        if (index !== -1) {
          const updatedArtifacts = [...artifacts];
          updatedArtifacts[index] = {
            ...updatedArtifacts[index],
            ...updates,
            updatedAt: new Date().toISOString(),
          };
          newArtifacts.set(messageId, updatedArtifacts);
          break;
        }
      }

      return { artifacts: newArtifacts };
    });
  },

  clearArtifacts: () => {
    set({ artifacts: new Map(), selectedArtifact: null });
  },
}));
