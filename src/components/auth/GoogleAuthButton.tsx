import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../state/AuthContext";
import { getGoogleAuthConfig } from "../../lib/authApi";
import { renderGoogleSignInButton } from "../../lib/googleAuth";

const NAME_MIN = 2;
const NAME_MAX = 20;
const NAME_PATTERN = /^[a-zA-Z\- ']+$/;

function validateCharacterName(name: string, label: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN) return `${label} must be at least ${NAME_MIN} characters.`;
  if (trimmed.length > NAME_MAX) return `${label} must be ${NAME_MAX} characters or fewer.`;
  if (!NAME_PATTERN.test(trimmed)) return `${label} may only contain letters, hyphens, and apostrophes.`;
  return null;
}

type PendingRegistration = {
  pendingToken: string;
  suggestedFirstName: string;
  suggestedLastName: string;
  email: string;
};

export function GoogleAuthButton({ redirectTarget }: { redirectTarget: string }) {
  const { continueWithGoogle, completeGoogleRegistration } = useAuth();
  const navigate = useNavigate();
  const buttonHostRef = useRef<HTMLDivElement | null>(null);

  const [configured, setConfigured] = useState(false);
  const [configChecked, setConfigChecked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRegistration | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function handleCredential(credential: string) {
      setError(null);
      setIsProcessing(true);
      try {
        const result = await continueWithGoogle(credential);
        if (!result.ok) {
          setError(
            result.code === "ACCOUNT_LINK_REQUIRED"
              ? "An account with this email already exists. Sign in with your password below, then link Google from your account."
              : result.error,
          );
          return;
        }

        if (result.status === "registration_required") {
          setPending({
            pendingToken: result.pendingToken,
            suggestedFirstName: result.suggestedFirstName,
            suggestedLastName: result.suggestedLastName,
            email: result.email,
          });
          setFirstName(result.suggestedFirstName);
          setLastName(result.suggestedLastName);
          return;
        }

        navigate(redirectTarget, { replace: true });
      } finally {
        setIsProcessing(false);
      }
    }

    async function setUp() {
      const config = await getGoogleAuthConfig();
      if (cancelled) return;

      if (!config.ok || !config.configured || !config.clientId) {
        setConfigured(false);
        setConfigChecked(true);
        return;
      }

      setConfigured(true);
      setConfigChecked(true);

      if (!buttonHostRef.current) return;
      try {
        // Google's own callback fires only on a genuinely completed sign-in;
        // closing the popup or dismissing the prompt simply never calls it,
        // so there is no false "server error" to suppress here - the button
        // just returns to its idle state.
        await renderGoogleSignInButton(config.clientId, buttonHostRef.current, (credential) => {
          void handleCredential(credential);
        });
      } catch {
        if (!cancelled) {
          setConfigured(false);
        }
      }
    }

    void setUp();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConfirmName(event: React.FormEvent) {
    event.preventDefault();
    setNameTouched(true);
    if (!pending) return;

    const firstErr = validateCharacterName(firstName, "First name");
    const lastErr = validateCharacterName(lastName, "Last name");
    if (firstErr || lastErr) return;

    setIsProcessing(true);
    setError(null);
    try {
      const result = await completeGoogleRegistration({
        pendingToken: pending.pendingToken,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      navigate("/ciel-intro", { replace: true, state: { afterTutorial: redirectTarget } });
    } finally {
      setIsProcessing(false);
    }
  }

  if (pending) {
    const firstErr = nameTouched ? validateCharacterName(firstName, "First name") : null;
    const lastErr = nameTouched ? validateCharacterName(lastName, "Last name") : null;

    return (
      <div className="google-auth-panel google-auth-panel--confirm" role="group" aria-label="Confirm your Nexis character name">
        <p className="google-auth-panel__lead">
          Almost there, {pending.email}. Choose the first and last name your character will use in Nexis.
        </p>
        <form className="google-auth-panel__form" onSubmit={handleConfirmName} noValidate>
          <div className="register-row">
            <div className="register-field">
              <label className="register-label" htmlFor="google-first-name">First Name</label>
              <input
                id="google-first-name"
                type="text"
                className={`register-input${firstErr ? " register-input--error" : ""}`}
                value={firstName}
                maxLength={NAME_MAX + 4}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
                autoFocus
              />
              {firstErr ? <p className="register-error" role="alert">{firstErr}</p> : null}
            </div>
            <div className="register-field">
              <label className="register-label" htmlFor="google-last-name">Last Name</label>
              <input
                id="google-last-name"
                type="text"
                className={`register-input${lastErr ? " register-input--error" : ""}`}
                value={lastName}
                maxLength={NAME_MAX + 4}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
              />
              {lastErr ? <p className="register-error" role="alert">{lastErr}</p> : null}
            </div>
          </div>
          {error ? <div className="register-server-error" role="alert">{error}</div> : null}
          <button type="submit" className="register-submit" disabled={isProcessing}>
            {isProcessing ? "Creating Account..." : "Confirm & Enter Nexis"}
          </button>
          <button
            type="button"
            className="register-switch__btn google-auth-panel__cancel"
            onClick={() => {
              setPending(null);
              setError(null);
            }}
            disabled={isProcessing}
          >
            Cancel
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="google-auth-panel">
      {error ? <div className="register-server-error" role="alert">{error}</div> : null}
      {configChecked && !configured ? null : (
        <>
          <div className="google-auth-panel__button" ref={buttonHostRef} aria-busy={isProcessing} />
          {isProcessing ? <p className="google-auth-panel__status">Signing in with Google...</p> : null}
          <div className="google-auth-panel__divider" role="separator" aria-label="or continue with email">
            <span>or continue with email</span>
          </div>
        </>
      )}
    </div>
  );
}
