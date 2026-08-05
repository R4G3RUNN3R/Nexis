import { useEffect, useState } from "react";

// Purely local display preferences (not server-authoritative game state) -
// stored in localStorage, same trust tier as things like theme choice.
const NEWS_TICKER_KEY = "nexis_pref_news_ticker";

function readBooleanPref(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "1";
  } catch {
    return fallback;
  }
}

function writeBooleanPref(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Ignore storage failures (private browsing, quota, etc.) - the
    // preference just won't persist across reloads.
  }
}

export function useNewsTickerPreference(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabled] = useState(() => readBooleanPref(NEWS_TICKER_KEY, true));

  useEffect(() => {
    writeBooleanPref(NEWS_TICKER_KEY, enabled);
  }, [enabled]);

  return [enabled, setEnabled];
}
