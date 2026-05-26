import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Conversation branch
 * Represents a fork point in conversation history
 */
export interface ConversationBranch {
  id: string;
  conversationId: string;
  parentBranchId: string | null; // null for root branch
  name: string;
  description?: string;
  forkPointMessageId: string; // Message ID where this branch diverges
  createdAt: number;
  messageIds: string[]; // Messages in this branch after fork point
  isActive: boolean;
}

/**
 * Branch metadata for quick lookups
 */
export interface BranchMetadata {
  conversationId: string;
  branches: ConversationBranch[];
  activeBranchId: string | null;
  rootBranchId: string; // Main conversation branch
}

interface BranchStore {
  // State
  branchMetadata: Map<string, BranchMetadata>; // conversationId -> metadata
  showBranchViewer: boolean;
  selectedConversation: string | null;

  // Actions
  createBranch: (
    conversationId: string,
    forkPointMessageId: string,
    name: string,
    description?: string,
  ) => string;
  switchBranch: (conversationId: string, branchId: string) => void;
  deleteBranch: (conversationId: string, branchId: string) => void;
  renameBranch: (branchId: string, newName: string) => void;
  updateBranchDescription: (branchId: string, description: string) => void;
  mergeBranch: (
    conversationId: string,
    sourceBranchId: string,
    targetBranchId: string,
  ) => void;
  getActiveBranch: (conversationId: string) => ConversationBranch | null;
  getBranchTree: (conversationId: string) => ConversationBranch[];
  toggleBranchViewer: () => void;
  setSelectedConversation: (conversationId: string | null) => void;
  getBranchPath: (
    conversationId: string,
    branchId: string,
  ) => ConversationBranch[];
}

/**
 * Generate unique ID
 */
const generateId = () =>
  `branch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useBranchStore = create<BranchStore>()(
  persist(
    (set, get) => ({
      // Initial state
      branchMetadata: new Map(),
      showBranchViewer: false,
      selectedConversation: null,

      // Create a new branch from a fork point
      createBranch: (conversationId, forkPointMessageId, name, description) => {
        const branchId = generateId();

        set((state) => {
          const metadata = new Map(state.branchMetadata);
          let conversationMeta = metadata.get(conversationId);

          if (!conversationMeta) {
            // First branch - create root branch
            const rootBranchId = `${conversationId}-root`;
            const rootBranch: ConversationBranch = {
              id: rootBranchId,
              conversationId,
              parentBranchId: null,
              name: "Main",
              forkPointMessageId: "", // Root has no fork point
              createdAt: Date.now(),
              messageIds: [],
              isActive: false,
            };

            conversationMeta = {
              conversationId,
              branches: [rootBranch],
              activeBranchId: rootBranchId,
              rootBranchId,
            };
          }

          // Find current active branch to set as parent
          const currentBranch = conversationMeta.branches.find(
            (b) => b.id === conversationMeta!.activeBranchId,
          );

          const newBranch: ConversationBranch = {
            id: branchId,
            conversationId,
            parentBranchId: currentBranch?.id || conversationMeta.rootBranchId,
            name,
            description,
            forkPointMessageId,
            createdAt: Date.now(),
            messageIds: [],
            isActive: true,
          };

          // Deactivate all other branches
          conversationMeta.branches = conversationMeta.branches.map((b) => ({
            ...b,
            isActive: false,
          }));

          // Add new branch
          conversationMeta.branches.push(newBranch);
          conversationMeta.activeBranchId = branchId;

          metadata.set(conversationId, conversationMeta);

          return { branchMetadata: metadata };
        });

        return branchId;
      },

      // Switch to a different branch
      switchBranch: (conversationId, branchId) => {
        set((state) => {
          const metadata = new Map(state.branchMetadata);
          const conversationMeta = metadata.get(conversationId);

          if (!conversationMeta) return state;

          // Deactivate all branches
          conversationMeta.branches = conversationMeta.branches.map((b) => ({
            ...b,
            isActive: b.id === branchId,
          }));

          conversationMeta.activeBranchId = branchId;
          metadata.set(conversationId, conversationMeta);

          return { branchMetadata: metadata };
        });
      },

      // Delete a branch (cannot delete root or active branch)
      deleteBranch: (conversationId, branchId) => {
        set((state) => {
          const metadata = new Map(state.branchMetadata);
          const conversationMeta = metadata.get(conversationId);

          if (!conversationMeta) return state;

          // Don't delete root or active branch
          if (
            branchId === conversationMeta.rootBranchId ||
            branchId === conversationMeta.activeBranchId
          ) {
            return state;
          }

          // Remove branch and its children
          const branchesToDelete = new Set<string>([branchId]);
          let foundMore = true;

          while (foundMore) {
            foundMore = false;
            conversationMeta.branches.forEach((b) => {
              if (b.parentBranchId && branchesToDelete.has(b.parentBranchId)) {
                if (!branchesToDelete.has(b.id)) {
                  branchesToDelete.add(b.id);
                  foundMore = true;
                }
              }
            });
          }

          conversationMeta.branches = conversationMeta.branches.filter(
            (b) => !branchesToDelete.has(b.id),
          );

          metadata.set(conversationId, conversationMeta);

          return { branchMetadata: metadata };
        });
      },

      // Rename a branch
      renameBranch: (branchId, newName) => {
        set((state) => {
          const metadata = new Map(state.branchMetadata);

          // Find the branch across all conversations
          for (const [conversationId, conversationMeta] of metadata.entries()) {
            const branchIndex = conversationMeta.branches.findIndex(
              (b) => b.id === branchId,
            );

            if (branchIndex !== -1) {
              conversationMeta.branches[branchIndex].name = newName;
              metadata.set(conversationId, conversationMeta);
              break;
            }
          }

          return { branchMetadata: metadata };
        });
      },

      // Update branch description
      updateBranchDescription: (branchId, description) => {
        set((state) => {
          const metadata = new Map(state.branchMetadata);

          for (const [conversationId, conversationMeta] of metadata.entries()) {
            const branchIndex = conversationMeta.branches.findIndex(
              (b) => b.id === branchId,
            );

            if (branchIndex !== -1) {
              conversationMeta.branches[branchIndex].description = description;
              metadata.set(conversationId, conversationMeta);
              break;
            }
          }

          return { branchMetadata: metadata };
        });
      },

      // Merge one branch into another
      mergeBranch: (conversationId, sourceBranchId, targetBranchId) => {
        set((state) => {
          const metadata = new Map(state.branchMetadata);
          const conversationMeta = metadata.get(conversationId);

          if (!conversationMeta) return state;

          const sourceBranch = conversationMeta.branches.find(
            (b) => b.id === sourceBranchId,
          );
          const targetBranch = conversationMeta.branches.find(
            (b) => b.id === targetBranchId,
          );

          if (!sourceBranch || !targetBranch) return state;

          // Merge message IDs from source to target
          targetBranch.messageIds = [
            ...targetBranch.messageIds,
            ...sourceBranch.messageIds,
          ];

          // Delete source branch after merge
          conversationMeta.branches = conversationMeta.branches.filter(
            (b) => b.id !== sourceBranchId,
          );

          metadata.set(conversationId, conversationMeta);

          return { branchMetadata: metadata };
        });
      },

      // Get currently active branch for a conversation
      getActiveBranch: (conversationId) => {
        const metadata = get().branchMetadata.get(conversationId);
        if (!metadata) return null;

        return (
          metadata.branches.find((b) => b.id === metadata.activeBranchId) ||
          null
        );
      },

      // Get all branches for a conversation as a tree
      getBranchTree: (conversationId) => {
        const metadata = get().branchMetadata.get(conversationId);
        return metadata ? metadata.branches : [];
      },

      // Get path from root to specific branch
      getBranchPath: (conversationId, branchId) => {
        const metadata = get().branchMetadata.get(conversationId);
        if (!metadata) return [];

        const path: ConversationBranch[] = [];
        let currentBranchId: string | null = branchId;

        while (currentBranchId) {
          const branch = metadata.branches.find(
            (b) => b.id === currentBranchId,
          );
          if (!branch) break;

          path.unshift(branch);
          currentBranchId = branch.parentBranchId;
        }

        return path;
      },

      // Toggle branch viewer
      toggleBranchViewer: () => {
        set((state) => ({ showBranchViewer: !state.showBranchViewer }));
      },

      // Set selected conversation for branch viewer
      setSelectedConversation: (conversationId) => {
        set({ selectedConversation: conversationId });
      },
    }),
    {
      name: "branch-store",
      partialize: (state) => ({
        branchMetadata: Array.from(state.branchMetadata.entries()),
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.branchMetadata)) {
          state.branchMetadata = new Map(
            state.branchMetadata as [string, BranchMetadata][],
          );
        }
      },
    },
  ),
);
