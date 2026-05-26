import React, { useEffect, useState } from "react";
import { useUpdateStore } from "@/lib/stores/updateStore";
import { useUiStore } from "@/lib/stores/uiStore";
import { invokeSafe, isTauriEnvironment } from "@/lib/utils/tauri";

export const UpdateManager: React.FC = () => {
  const {
    updateStatus,
    isChecking,
    isDownloading,
    downloadProgress,
    dismissedVersions,
    setCurrentVersion,
    setUpdateStatus,
    setIsChecking,
    setIsDownloading,
    setDownloadProgress,
    setLastCheckTime,
    dismissUpdate,
  } = useUpdateStore();

  const { addToast } = useUiStore();
  const [showDialog, setShowDialog] = useState(false);
  // Detect test environment without referencing `process` directly to avoid
  // TypeScript errors when `@types/node` isn't available in the workspace.
  const isTestEnv =
    typeof (globalThis as any).process !== "undefined" &&
    (globalThis as any).process.env?.NODE_ENV === "test";

  // Initialize current version on mount
  useEffect(() => {
    const initializeVersion = async () => {
      // Skip if not in Tauri environment (web preview)
      if (!isTauriEnvironment() && !isTestEnv) return;

      try {
        const version = await invokeSafe<string>("get_current_version");
        if (version) {
          setCurrentVersion(version);
        }
      } catch (error) {
        console.error("Failed to get current version:", error);
      }
    };

    initializeVersion();
  }, [isTestEnv, setCurrentVersion]);

  // Stabilize performUpdateCheck so the effect below can depend on it
  const performUpdateCheck = React.useCallback(async () => {
    setIsChecking(true);
    try {
      let status: any = null;

      if (isTauriEnvironment()) {
        status = await invokeSafe<any>("check_for_updates");
      } else if (isTestEnv) {
        // In tests we mock @tauri-apps/api/core directly; attempt to import it
        // and call the mocked invoke so the component can be exercised in
        // non-Tauri test environment.
        try {
          const core = await import("@tauri-apps/api/core");
          if (core && typeof (core as any).invoke === "function") {
            status = await (core as any).invoke("check_for_updates");
          }
        } catch {
          // ignore import failures and leave status as null
        }
      }
      if (status) {
        setUpdateStatus(status);
      }
      setLastCheckTime(Date.now());

      // Show notification if update is available and not dismissed
      if (
        status &&
        status.has_update &&
        status.new_version &&
        !dismissedVersions.includes(status.new_version)
      ) {
        addToast({
          message: `Update available: v${status.new_version}`,
          type: "info",
          ttl: 8000,
        });
        setShowDialog(true);
      }
    } catch (error) {
      console.error("Failed to check for updates:", error);
      addToast({
        message: "Failed to check for updates",
        type: "error",
        ttl: 5000,
      });
    } finally {
      setIsChecking(false);
    }
  }, [addToast, dismissedVersions, setUpdateStatus, setLastCheckTime, setShowDialog, setIsChecking, isTestEnv]);

  // Auto-check for updates on mount and periodically
  useEffect(() => {
    // Skip if not in Tauri environment (web preview)
    if (!isTauriEnvironment() && !isTestEnv) return;

    const checkUpdates = async () => {
      await performUpdateCheck();
    };

    checkUpdates();

    // Check for updates every hour (3600000 ms)
    const interval = setInterval(checkUpdates, 3600000);

    return () => clearInterval(interval);
  }, [isTestEnv, performUpdateCheck]);



  const handleDownloadUpdate = async () => {
    if (!updateStatus?.new_version) return;

    setIsDownloading(true);
    try {
      if (isTauriEnvironment()) {
        await invokeSafe<string>("download_and_install_update", {
          version: updateStatus.new_version,
        });
      } else if (isTestEnv) {
        try {
          const core = await import("@tauri-apps/api/core");
          if (core && typeof (core as any).invoke === "function") {
            await (core as any).invoke("download_and_install_update", {
              version: updateStatus.new_version,
            });
          }
        } catch {
          // ignore
        }
      }

      addToast({
        message: `Downloaded v${updateStatus.new_version}. Close the app and run the new AppImage to install.`,
        type: "success",
        ttl: 10000,
      });

      setShowDialog(false);
    } catch (error) {
      console.error("Failed to download update:", error);
      addToast({
        message: `Failed to download update: ${error}`,
        type: "error",
        ttl: 5000,
      });
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleDismiss = () => {
    if (updateStatus?.new_version) {
      dismissUpdate(updateStatus.new_version);
    }
    setShowDialog(false);
  };

  if (!showDialog || !updateStatus || !updateStatus.has_update) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">
          Update Available
        </h2>

        <p className="text-slate-600 dark:text-slate-300 mb-2">
          Version{" "}
          <span className="font-semibold">{updateStatus.new_version}</span> is
          now available
        </p>

        {updateStatus.release_info?.is_critical && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
            ⚠️ Critical security update recommended
          </div>
        )}

        {updateStatus.release_info?.changelog && (
          <div className="mb-4 max-h-40 overflow-y-auto">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Changelog:
            </p>
            <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-3 rounded">
              {updateStatus.release_info.changelog
                .split("\n")
                .slice(0, 5)
                .join("\n")}
              {updateStatus.release_info.changelog.split("\n").length > 5 &&
                "..."}
            </div>
          </div>
        )}

        {updateStatus.error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
            Error: {updateStatus.error}
          </div>
        )}

        {isDownloading && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-600 dark:text-slate-300">
                Downloading...
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                {downloadProgress}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleDismiss}
            disabled={isDownloading}
            className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Later
          </button>
          <button
            onClick={performUpdateCheck}
            disabled={isDownloading || isChecking}
            className="flex-1 px-4 py-2 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChecking ? "Checking..." : "Check Again"}
          </button>
          <button
            onClick={handleDownloadUpdate}
            disabled={isDownloading}
            className="flex-1 px-4 py-2 text-white bg-blue-500 hover:bg-blue-600 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? "Downloading..." : "Download"}
          </button>
        </div>

        <button
          onClick={() => setShowDialog(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default UpdateManager;
