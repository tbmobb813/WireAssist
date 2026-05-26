import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Memory entry stored for a project/conversation
 */
export interface MemoryEntry {
  id: string;
  content: string;
  context?: string; // Optional context about when/why it was remembered
  tags: string[];
  createdAt: number;
  conversationId?: string;
  messageId?: string;
  tokenCount: number; // Estimated token count for cleanup
}

/**
 * Project-specific memory collection
 */
export interface ProjectMemory {
  projectPath: string;
  entries: MemoryEntry[];
  totalTokens: number;
  maxTokens: number; // Limit before auto-cleanup
  lastAccessed: number;
}

interface MemoryStore {
  // State
  memories: Map<string, ProjectMemory>;
  currentProject: string | null;
  isMemoryViewerOpen: boolean;
  searchQuery: string;

  // Actions
  addMemory: (
    content: string,
    options?: {
      context?: string;
      tags?: string[];
      conversationId?: string;
      messageId?: string;
    },
  ) => string;
  removeMemory: (memoryId: string) => void;
  updateMemory: (memoryId: string, updates: Partial<MemoryEntry>) => void;
  recallMemories: (query: string, limit?: number) => MemoryEntry[];
  setCurrentProject: (projectPath: string) => void;
  toggleMemoryViewer: () => void;
  setSearchQuery: (query: string) => void;
  clearProjectMemories: (projectPath: string) => void;
  autoCleanup: (projectPath: string) => void;
  exportMemories: (projectPath: string) => string;
  importMemories: (projectPath: string, data: string) => void;
  getProjectMemory: (projectPath: string) => ProjectMemory | undefined;
}

/**
 * Generate unique ID
 */
const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

/**
 * Calculate similarity score between query and memory content
 * Enhanced algorithm with:
 * - TF-IDF weighting for important terms
 * - Context matching
 * - Recency boost
 * - Tag matching bonus
 */
const calculateSimilarity = (
  query: string,
  memory: MemoryEntry,
  allMemories: MemoryEntry[],
): number => {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2); // Filter out short words
  const contentWords = memory.content
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const contextWords = memory.context
    ? memory.context
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
    : [];

  if (queryWords.length === 0) return 0;

  // 1. Calculate TF-IDF scores for query terms
  const termFrequency = new Map<string, number>();
  const documentFrequency = new Map<string, number>();

  // Calculate term frequency in current memory
  contentWords.forEach((word) => {
    termFrequency.set(word, (termFrequency.get(word) || 0) + 1);
  });

  // Calculate document frequency across all memories
  allMemories.forEach((mem) => {
    const words = new Set(
      mem.content
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );
    words.forEach((word) => {
      documentFrequency.set(word, (documentFrequency.get(word) || 0) + 1);
    });
  });

  // Calculate TF-IDF weighted similarity
  let tfidfScore = 0;
  let maxPossibleScore = 0;

  queryWords.forEach((qWord) => {
    const tf = termFrequency.get(qWord) || 0;
    const df = documentFrequency.get(qWord) || 1;
    const idf = Math.log(allMemories.length / df);
    const tfidf = tf * idf;

    maxPossibleScore += idf; // Best case: term appears once
    tfidfScore += tfidf;

    // Also check partial matches
    contentWords.forEach((cWord) => {
      if (cWord.includes(qWord) || qWord.includes(cWord)) {
        tfidfScore += tfidf * 0.5; // Partial match bonus
      }
    });
  });

  const normalizedTfidf =
    maxPossibleScore > 0 ? tfidfScore / maxPossibleScore : 0;

  // 2. Context matching bonus
  let contextScore = 0;
  if (contextWords.length > 0) {
    const contextMatches = queryWords.filter((qWord) =>
      contextWords.some(
        (cWord) => cWord.includes(qWord) || qWord.includes(cWord),
      ),
    );
    contextScore = contextMatches.length / queryWords.length;
  }

  // 3. Tag matching bonus
  let tagScore = 0;
  if (memory.tags && memory.tags.length > 0) {
    const tagMatches = queryWords.filter((qWord) =>
      memory.tags.some((tag) => tag.toLowerCase().includes(qWord)),
    );
    tagScore = tagMatches.length / queryWords.length;
  }

  // 4. Recency boost (memories from last 24h get small boost)
  const hoursSinceCreation = (Date.now() - memory.createdAt) / (1000 * 60 * 60);
  const recencyBoost = hoursSinceCreation < 24 ? 0.1 : 0;

  // Combine scores with weights
  const finalScore =
    normalizedTfidf * 0.6 + // Main content similarity
    contextScore * 0.2 + // Context relevance
    tagScore * 0.15 + // Tag matching
    recencyBoost; // Recent memory bonus

  return Math.min(finalScore, 1.0); // Cap at 1.0
}; /**
 * Default max tokens per project (roughly equivalent to ~8k tokens)
 */
const DEFAULT_MAX_TOKENS = 8000;

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      // Initial state
      memories: new Map(),
      currentProject: null,
      isMemoryViewerOpen: false,
      searchQuery: "",

      // Add a new memory entry
      addMemory: (content, options = {}) => {
        const state = get();
        const projectPath = options.conversationId
          ? `conversation-${options.conversationId}`
          : state.currentProject || "default";

        const memoryId = generateId();
        const tokenCount = estimateTokens(content);

        const entry: MemoryEntry = {
          id: memoryId,
          content,
          context: options.context,
          tags: options.tags || [],
          createdAt: Date.now(),
          conversationId: options.conversationId,
          messageId: options.messageId,
          tokenCount,
        };

        set((state) => {
          const memories = new Map(state.memories);
          const projectMemory = memories.get(projectPath) || {
            projectPath,
            entries: [],
            totalTokens: 0,
            maxTokens: DEFAULT_MAX_TOKENS,
            lastAccessed: Date.now(),
          };

          projectMemory.entries.push(entry);
          projectMemory.totalTokens += tokenCount;
          projectMemory.lastAccessed = Date.now();

          memories.set(projectPath, projectMemory);

          return { memories };
        });

        // Auto-cleanup if over limit
        const projectMemory = get().memories.get(projectPath);
        if (
          projectMemory &&
          projectMemory.totalTokens > projectMemory.maxTokens
        ) {
          get().autoCleanup(projectPath);
        }

        return memoryId;
      },

      // Remove a memory entry
      removeMemory: (memoryId) => {
        set((state) => {
          const memories = new Map(state.memories);

          for (const [projectPath, projectMemory] of memories.entries()) {
            const entryIndex = projectMemory.entries.findIndex(
              (e) => e.id === memoryId,
            );

            if (entryIndex !== -1) {
              const removedEntry = projectMemory.entries[entryIndex];
              projectMemory.entries.splice(entryIndex, 1);
              projectMemory.totalTokens -= removedEntry.tokenCount;
              memories.set(projectPath, projectMemory);
              break;
            }
          }

          return { memories };
        });
      },

      // Update a memory entry
      updateMemory: (memoryId, updates) => {
        set((state) => {
          const memories = new Map(state.memories);

          for (const [projectPath, projectMemory] of memories.entries()) {
            const entry = projectMemory.entries.find((e) => e.id === memoryId);

            if (entry) {
              // Recalculate tokens if content changed
              const oldTokens = entry.tokenCount;
              const newContent = updates.content || entry.content;
              const newTokens = estimateTokens(newContent);

              Object.assign(entry, updates);
              entry.tokenCount = newTokens;

              projectMemory.totalTokens =
                projectMemory.totalTokens - oldTokens + newTokens;
              memories.set(projectPath, projectMemory);
              break;
            }
          }

          return { memories };
        });
      },

      // Recall memories matching a query
      recallMemories: (query, limit = 10) => {
        const state = get();
        const projectPath = state.currentProject || "default";
        const projectMemory = state.memories.get(projectPath);

        if (!projectMemory || projectMemory.entries.length === 0) {
          return [];
        }

        const allEntries = projectMemory.entries;

        // Calculate similarity scores with enhanced algorithm
        const scoredEntries = allEntries.map((entry) => ({
          entry,
          score: calculateSimilarity(query, entry, allEntries),
        }));

        return scoredEntries
          .filter((item) => item.score > 0.15) // Slightly higher threshold for better results
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((item) => item.entry);
      },

      // Set current project
      setCurrentProject: (projectPath) => {
        set({ currentProject: projectPath });

        // Update last accessed time
        set((state) => {
          const memories = new Map(state.memories);
          const projectMemory = memories.get(projectPath);

          if (projectMemory) {
            projectMemory.lastAccessed = Date.now();
            memories.set(projectPath, projectMemory);
          }

          return { memories };
        });
      },

      // Toggle memory viewer
      toggleMemoryViewer: () => {
        set((state) => ({ isMemoryViewerOpen: !state.isMemoryViewerOpen }));
      },

      // Set search query
      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      // Clear all memories for a project
      clearProjectMemories: (projectPath) => {
        set((state) => {
          const memories = new Map(state.memories);
          memories.delete(projectPath);
          return { memories };
        });
      },

      // Auto-cleanup oldest entries when over token limit
      autoCleanup: (projectPath) => {
        set((state) => {
          const memories = new Map(state.memories);
          const projectMemory = memories.get(projectPath);

          if (!projectMemory) return state;

          // Sort by creation date (oldest first) and remove until under limit
          const sortedEntries = [...projectMemory.entries].sort(
            (a, b) => a.createdAt - b.createdAt,
          );

          let totalTokens = projectMemory.totalTokens;
          const targetTokens = projectMemory.maxTokens * 0.8; // Clean to 80% of max
          const keptEntries: MemoryEntry[] = [];

          // Keep newest entries until we're under target
          for (let i = sortedEntries.length - 1; i >= 0; i--) {
            const entry = sortedEntries[i];
            if (totalTokens <= targetTokens) {
              keptEntries.unshift(entry);
            } else {
              totalTokens -= entry.tokenCount;
            }
          }

          projectMemory.entries = keptEntries;
          projectMemory.totalTokens = totalTokens;
          memories.set(projectPath, projectMemory);

          return { memories };
        });
      },

      // Export memories as JSON
      exportMemories: (projectPath) => {
        const projectMemory = get().memories.get(projectPath);
        if (!projectMemory) return "{}";

        return JSON.stringify(projectMemory, null, 2);
      },

      // Import memories from JSON
      importMemories: (projectPath, data) => {
        try {
          const imported = JSON.parse(data) as ProjectMemory;

          set((state) => {
            const memories = new Map(state.memories);
            memories.set(projectPath, imported);
            return { memories };
          });
        } catch (error) {
          console.error("Failed to import memories:", error);
        }
      },

      // Get project memory
      getProjectMemory: (projectPath) => {
        return get().memories.get(projectPath);
      },
    }),
    {
      name: "linux-ai-assistant-memory",
      partialize: (state) => ({
        // Convert Map to array for serialization
        memories: Array.from(state.memories.entries()),
        currentProject: state.currentProject,
      }),
      // Deserialize Map properly
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.memories)) {
          state.memories = new Map(state.memories as any);
        }
      },
    },
  ),
);
