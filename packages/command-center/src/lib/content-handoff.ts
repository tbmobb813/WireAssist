// Carries a completed Research finding or GTM strategy over to the Content page
// as generation context, via sessionStorage — no backend plumbing, and the human
// sees the handoff happen (it's a click + a pre-filled form) rather than agents
// silently reading each other's memory.
const KEY = 'wireassist:content-handoff';

export type ContentHandoff =
  | { kind: 'research'; topic: string; context: string }
  | { kind: 'gtm'; product: string; context: string };

export function setContentHandoff(handoff: ContentHandoff): void {
  sessionStorage.setItem(KEY, JSON.stringify(handoff));
}

/** Reads and clears the pending handoff, if any. Call once on the Content page's mount. */
export function consumeContentHandoff(): ContentHandoff | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  try {
    return JSON.parse(raw) as ContentHandoff;
  } catch {
    return null;
  }
}
