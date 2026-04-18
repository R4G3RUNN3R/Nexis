// ─────────────────────────────────────────────────────────────────────────────
// Nexis — CIEL Dialogue UI
// Dry, sarcastic, page-aware quick prompts. No cheerfulness.
// ─────────────────────────────────────────────────────────────────────────────

type Message = {
  role: "ciel" | "player";
  text: string;
};

type Props = {
  open: boolean;
  position: { x: number; y: number };
  pathname: string;
  latestMessage: string;
  messages: Message[];
  onClose: () => void;
  onClear: () => void;
  onAsk: (question: string) => void;
};

// Quick prompts per route — written in player voice, answered by CIEL
const quickQuestions: Record<string, string[]> = {
  "/": [
    "What should I actually do first?",
    "Explain my stat bars.",
    "Why does Comfort matter?",
  ],
  "/inventory": [
    "What do I do with these items?",
    "How do I get more materials?",
    "What are Professions?",
  ],
  "/adventure": [
    "How does the XP bar work?",
    "What happens if I crit fail?",
    "Which job is best to start?",
  ],
  "/civic-jobs": [
    "How do civic jobs differ from adventure work?",
    "Which civic track is easiest to enter first?",
    "What do job points actually do?",
  ],
  "/education": [
    "Why is education important?",
    "Does hospital stop my course?",
    "What should I study first?",
  ],
  "/hospital": [
    "Why am I blocked from jobs?",
    "Does my education keep going?",
    "How do I recover faster?",
  ],
  "/travel": [
    "What are the five cities?",
    "Which academy is where?",
    "How does travel work?",
  ],
  "/housing": [
    "What does property actually do?",
    "Should I upgrade or save gold?",
    "Which tier is worth buying first?",
  ],
  "/academies": [
    "Can I switch academies?",
    "What's the Western branch?",
    "What is Nexis Professions?",
  ],
  "/guilds": [
    "What are guilds for?",
    "How do I found one?",
  ],
  "/consortiums": [
    "What are consortiums for?",
    "How do I found one?",
  ],
  "/profile": [
    "What does my profile show?",
    "What is a Life Path?",
  ],
};

const defaultPrompts = [
  "Explain this page.",
  "What should I do next?",
  "What are you, exactly?",
];

export default function CielDialogue({
  open,
  position,
  pathname,
  latestMessage,
  messages,
  onClose,
  onClear,
  onAsk,
}: Props) {
  if (!open) return null;

  const left = Math.max(16, position.x - 360);
  const top  = Math.max(16, position.y - 250);
  const prompts = quickQuestions[pathname] ?? defaultPrompts;
  const pageLabel = pathname === "/" ? "home" : pathname.replace("/", "");

  return (
    <div
      className="ciel-dialogue"
      style={{ left, top }}
      role="dialog"
      aria-label="CIEL"
    >
      <div className="ciel-dialogue__header">
        <div>
          <div className="ciel-dialogue__title">CIEL</div>
          <div className="ciel-dialogue__page">{pageLabel}</div>
        </div>

        <div className="ciel-dialogue__actions">
          <button type="button" className="ciel-dialogue__icon-button" onClick={onClear} title="Clear">
            Clear
          </button>
          <button type="button" className="ciel-dialogue__icon-button" onClick={onClose} title="Close">
            Close
          </button>
        </div>
      </div>

      <div className="ciel-dialogue__body">
        <div className="ciel-dialogue__latest">{latestMessage}</div>

        <div className="ciel-dialogue__prompt-label">Ask CIEL</div>
        <div className="ciel-dialogue__prompt-list">
          {prompts.map((prompt) => (
            <button
              key={`${pathname}-${prompt}`}
              type="button"
              className="ciel-dialogue__prompt"
              onClick={() => onAsk(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        {messages.length > 1 ? (
          <>
            <div className="ciel-dialogue__prompt-label">Exchange</div>
            <div className="ciel-dialogue__history">
              {messages.slice(-5).map((message, index) => (
                <div
                  key={`${message.role}-${index}-${message.text.slice(0, 16)}`}
                  className={`ciel-dialogue__message ciel-dialogue__message--${message.role}`}
                >
                  {message.text}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
