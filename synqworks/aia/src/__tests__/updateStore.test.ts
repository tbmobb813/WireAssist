import { describe, it, expect, beforeEach } from "vitest";
import { useUpdateStore } from "../lib/stores/updateStore";

describe("updateStore actions and state", () => {
  beforeEach(() => {
    // reset to known initial state before each test
    useUpdateStore.setState({
      currentVersion: "",
      updateStatus: null,
      isChecking: false,
      isDownloading: false,
      downloadProgress: 0,
      lastCheckTime: null,
      dismissedVersions: [],
    });
  });

  it("sets and reads simple fields", () => {
    const s1 = useUpdateStore.getState();
    expect(s1.currentVersion).toBe("");

    useUpdateStore.getState().setCurrentVersion("1.2.3");
    expect(useUpdateStore.getState().currentVersion).toBe("1.2.3");

    useUpdateStore.getState().setIsChecking(true);
    expect(useUpdateStore.getState().isChecking).toBe(true);

    useUpdateStore.getState().setIsDownloading(true);
    expect(useUpdateStore.getState().isDownloading).toBe(true);

    useUpdateStore.getState().setDownloadProgress(42);
    expect(useUpdateStore.getState().downloadProgress).toBe(42);

    const ts = Date.now();
    useUpdateStore.getState().setLastCheckTime(ts);
    expect(useUpdateStore.getState().lastCheckTime).toBe(ts);
  });

  it("manages updateStatus, errors and dismissed versions", () => {
    const status = {
      has_update: true,
      current_version: "1.0.0",
      new_version: "2.0.0",
      release_info: {
        version: "2.0.0",
        release_date: "now",
        changelog: "ok",
        download_url: "",
        is_critical: false,
      },
      is_installing: false,
      error: "boom",
    } as any;

    useUpdateStore.getState().setUpdateStatus(status);
    expect(useUpdateStore.getState().updateStatus).toBeTruthy();
    expect(useUpdateStore.getState().updateStatus?.error).toBe("boom");

    // clearError should remove the error but preserve other fields
    useUpdateStore.getState().clearError();
    expect(useUpdateStore.getState().updateStatus?.error).toBeUndefined();

    // dismiss version
    useUpdateStore.getState().resetDismissed();
    expect(useUpdateStore.getState().dismissedVersions).toEqual([]);

    useUpdateStore.getState().dismissUpdate("2.0.0");
    expect(useUpdateStore.getState().dismissedVersions).toContain("2.0.0");

    useUpdateStore.getState().resetDismissed();
    expect(useUpdateStore.getState().dismissedVersions).toEqual([]);
  });
});
