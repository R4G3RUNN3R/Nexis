export function askCiel(type: string, payload?: unknown) {
  window.dispatchEvent(
    new CustomEvent("ciel:ask", {
      detail: { type, payload },
    }),
  );
}
