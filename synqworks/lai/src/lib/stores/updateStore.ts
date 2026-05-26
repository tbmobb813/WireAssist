import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface VersionInfo {
  version: string;
  release_date: string;
  changelog: string;
  download_url: string;
  checksum?: string;
  is_critical: boolean;
}

export interface UpdateStatus {
  has_update: boolean;
  current_version: string;
  new_version?: string;
  release_info?: VersionInfo;
  is_installing: boolean;
  error?: string;
}

export interface UpdateStore {
  // State
  currentVersion: string;
  updateStatus: UpdateStatus | null;
  isChecking: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  lastCheckTime: number | null;
  dismissedVersions: string[];

  // Actions
  setCurrentVersion: (version: string) => void;
  setUpdateStatus: (status: UpdateStatus | null) => void;
  setIsChecking: (isChecking: boolean) => void;
  setIsDownloading: (isDownloading: boolean) => void;
  setDownloadProgress: (progress: number) => void;
  setLastCheckTime: (time: number) => void;
  dismissUpdate: (version: string) => void;
  resetDismissed: () => void;
  clearError: () => void;
}

export const useUpdateStore = create<UpdateStore>()(
  persist(
    (set) => ({
      // Initial state
      currentVersion: "",
      updateStatus: null,
      isChecking: false,
      isDownloading: false,
      downloadProgress: 0,
      lastCheckTime: null,
      dismissedVersions: [],

      // Actions
      setCurrentVersion: (version: string) => set({ currentVersion: version }),

      setUpdateStatus: (status: UpdateStatus | null) =>
        set({ updateStatus: status }),

      setIsChecking: (isChecking: boolean) => set({ isChecking }),

      setIsDownloading: (isDownloading: boolean) => set({ isDownloading }),

      setDownloadProgress: (progress: number) =>
        set({ downloadProgress: progress }),

      setLastCheckTime: (time: number) => set({ lastCheckTime: time }),

      dismissUpdate: (version: string) =>
        set((state) => ({
          dismissedVersions: [...state.dismissedVersions, version],
        })),

      resetDismissed: () => set({ dismissedVersions: [] }),

      clearError: () =>
        set((state) => ({
          updateStatus: state.updateStatus
            ? { ...state.updateStatus, error: undefined }
            : null,
        })),
    }),
    {
      name: "update-store",
      version: 1,
    },
  ),
);
