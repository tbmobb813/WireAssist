declare module 'readline';
declare module 'crypto';

// Minimal Node globals needed for the demo.
// These are intentionally very loose types.
declare const process: {
  exitCode?: number;
};
