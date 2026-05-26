export type ThemePref = "light" | "dark" | "system";

export function getSystemTheme(): "light" | "dark" {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "light";
  }
  try {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    return mq.matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(pref: ThemePref): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const mode = pref === "system" ? getSystemTheme() : pref;
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function watchSystemTheme(onChange: () => void): () => void {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => onChange();
  // Modern browsers support addEventListener; older ones use addListener
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  } else {
    // Legacy API fallback
     
    (mq as any).addListener(handler);
    return () => {
       
      (mq as any).removeListener(handler);
    };
  }
}
