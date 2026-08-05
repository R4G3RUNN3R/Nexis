type Props = {
  open: boolean;
  onClick: () => void;
  title?: string;
};

// CIEL used to be a free-draggable orb positioned by JS on mount, which let
// it drift on top of page content (see the Legacy Tree / Home overlap in the
// UI audit). It's now docked to a fixed viewport corner via CSS
// (.ciel-orb-anchor in ciel.css) so it can never land on top of a card - the
// shell also reserves bottom padding around the dock (see nexis-theme.css)
// so nothing renders underneath it.
export default function CielOrb({ open, onClick, title = "CIEL" }: Props) {
  return (
    <button
      type="button"
      className={`ciel-orb-anchor${open ? " ciel-orb-anchor--open" : ""}`}
      onClick={onClick}
      title={title}
      aria-label={open ? `${title} (close)` : `${title} (open)`}
      aria-expanded={open}
    >
      <span className="ciel-orb-shell">
        <span className="ciel-orb-core" />
        <span className="ciel-orb-ring ciel-orb-ring--one" />
        <span className="ciel-orb-ring ciel-orb-ring--two" />
        <span className="ciel-orb-spark ciel-orb-spark--one" />
        <span className="ciel-orb-spark ciel-orb-spark--two" />
      </span>
    </button>
  );
}
