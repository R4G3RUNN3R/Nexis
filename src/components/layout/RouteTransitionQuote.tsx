import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { cielLoadingQuotes } from "../../data/cielPageCopy";

const HIDE_DELAY_MS = 650;

function selectQuote(seed: string) {
  const index = Math.abs(Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0)) % cielLoadingQuotes.length;
  return cielLoadingQuotes[index];
}

export default function RouteTransitionQuote() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [quote, setQuote] = useState(() => selectQuote(location.pathname || "/"));
  const timerRef = useRef<number | null>(null);
  const previousPathRef = useRef(location.pathname);

  const quoteSeed = useMemo(() => `${location.pathname}|${location.key ?? "route"}`, [location.key, location.pathname]);

  useEffect(() => {
    if (previousPathRef.current === location.pathname) return;
    previousPathRef.current = location.pathname;

    setQuote(selectQuote(quoteSeed));
    setVisible(true);

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      timerRef.current = null;
    }, HIDE_DELAY_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [location.pathname, quoteSeed]);

  if (!visible) return null;

  return (
    <div className="route-transition-quote" aria-live="polite" aria-atomic="true">
      <div className="route-transition-quote__panel">
        <div className="route-transition-quote__label">CIEL</div>
        <div className="route-transition-quote__text">{quote}</div>
      </div>
    </div>
  );
}
