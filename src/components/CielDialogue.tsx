export type CielMessage = {
  role: "user" | "ciel";
  text: string;
};

type Props = {
  open: boolean;
  position: { x: number; y: number };
  pathname: string;
  latestMessage: string;
  messages: CielMessage[];
  onClose: () => void;
  onClear: () => void;
  onAsk: (question: string) => void;
};

const quickQuestions: Record<string, string[]> = {
  "/": ["What should I do first?", "What matters most right now?"],
  "/travel": [
    "What is this destination?",
    "Which academy is here?",
    "Why is this route restricted?",
  ],
  "/education": ["Why is Education important?", "What should I study first?"],
  "/hospital": [
    "Why am I blocked from some pages?",
    "Does Education continue here?",
  ],
};

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
  const top = Math.max(16, position.y - 250);
  const prompts =
    quickQuestions[pathname] ?? ["What is this page?", "What should I do next?"];

  return (
    <div className="ciel-dialogue" style={{ left, top }} role="dialog" aria-label="CIEL">
      <div className="ciel-dialogue__header">
        <div>
          <div className="ciel-dialogue__title">CIEL</div>
          <div className="ciel-dialogue__page">
            {pathname === "/" ? "home" : pathname.replace("/", "")}
          </div>
        </div>
        <div className="ciel-dialogue__actions">
          <button
            type="button"
            className="ciel-dialogue__icon-button"
            onClick={onClear}
            title="Clear"
          >
            Clear
          </button>
          <button
            type="button"
            className="ciel-dialogue__icon-button"
            onClick={onClose}
            title="Close"
          >
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
            <div className="ciel-dialogue__prompt-label">Recent Exchange</div>
            <div className="ciel-dialogue__history">
              {messages.slice(-4).map((message, index) => (
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
