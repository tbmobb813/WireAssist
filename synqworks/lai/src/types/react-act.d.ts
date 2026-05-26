// Declare `act` on React to satisfy tests that import { act } from 'react'
// (some test files import `act` from 'react' rather than react-dom/test-utils).
// This is a minimal shim to keep typechecking green; prefer updating tests
// to import from react-dom/test-utils in a follow-up if desired.

declare module "react" {
    // Minimal act declaration used in tests
    export function act(callback: () => any): any;
}
