import { waitFor } from "@testing-library/react";

/**
 * waitForInitMocks
 * Helper for tests that need to wait for component initialization effects
 * that call multiple async mocks (e.g. loadSettings and registerGlobalShortcut).
 *
 * Usage:
 *   await waitForInitMocks(loadSettingsMock, registerGlobalShortcutMock);
 *
 * This centralizes the timeout and the combined assertion so tests remain
 * concise and less flaky.
 */
export async function waitForInitMocks(...mocks: any[]) {
    // default timeout is 10s for initialization-heavy flows (increase to avoid
    // flakiness when running the whole suite in parallel)
    await waitFor(
        () => {
            for (const m of mocks) {
                // vitest provides the global expect matcher
                 
                expect(m).toHaveBeenCalled();
            }
        },
        { timeout: 10000 },
    );
}

export default waitForInitMocks;
