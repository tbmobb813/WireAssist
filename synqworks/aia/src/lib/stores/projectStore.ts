import { create } from "zustand";

export type ProjectEvent = {
  path: string;
  ts: number;
};

interface ProjectState {
  events: ProjectEvent[];
  addEvents: (paths: string[]) => void;
  clear: () => void;
  getRecentSummary: (max: number, windowMs: number) => string | null;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  events: [],
  addEvents: (paths) =>
    set((s) => ({
      events: [
        ...s.events,
        ...paths.map((p) => ({ path: p, ts: Date.now() })),
      ].slice(-500), // keep last 500
    })),
  clear: () => set({ events: [] }),
  getRecentSummary: (max, windowMs) => {
    const now = Date.now();
    const recent = get()
      .events.filter((e) => now - e.ts <= windowMs)
      .slice(-max);
    if (recent.length === 0) return null;
    const lines = recent.map((e) => `- ${e.path}`);
    return lines.join("\n");
  },
}));
