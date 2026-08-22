// Carries a completed Research finding over to the Ops (NixOps) page as the
// workflow brief, via sessionStorage — mirrors content-handoff.ts. Kept as a
// separate module rather than folded into that one: Research findings aren't
// always content-marketing material (e.g. competitor/listing research for a
// specific venture like NixLevel belongs in a NixOps workflow run instead).
const KEY = 'wireassist:ops-handoff';

export interface OpsHandoff {
  topic: string;
  context: string;
}

export function setOpsHandoff(handoff: OpsHandoff): void {
  sessionStorage.setItem(KEY, JSON.stringify(handoff));
}

/** Reads and clears the pending handoff, if any. Call once on the Ops page's mount. */
export function consumeOpsHandoff(): OpsHandoff | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  try {
    return JSON.parse(raw) as OpsHandoff;
  } catch {
    return null;
  }
}
