import { ReactNode, useState } from "react";

type ContentPanelProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function ContentPanel({
  title,
  children,
  defaultOpen = true,
}: ContentPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`panel${open ? "" : " panel--collapsed"}`}>
      <button
        type="button"
        className="panel__header panel__header--button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <h2>{title}</h2>
        <span className="panel__toggle">{open ? "−" : "+"}</span>
      </button>

      {open ? <div className="panel__body">{children}</div> : null}
    </section>
  );
}
