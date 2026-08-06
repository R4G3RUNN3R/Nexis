import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { confirmEmailChange } from "../lib/authApi";
import "../styles/register.css";

export default function ConfirmEmailChangePage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);

  async function handleConfirm() {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const result = await confirmEmailChange({ token });
      if (!result.ok) {
        setServerError(result.error ?? "This email confirmation link is invalid or expired.");
        return;
      }
      setConfirmedEmail(result.email);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="register-page">
      <div className="register-hero">
        <img
          src="/images/register/register_hero.png"
          alt="Nexis - Online Realm of Adventure"
          className="register-hero__img"
          draggable={false}
        />
        <div className="register-hero__overlay" />
        <div className="register-hero__title">
          <span className="register-hero__nexis">NEXIS</span>
          <span className="register-hero__sub">Confirm Your New Email</span>
        </div>
      </div>

      <div className="register-panel" role="main">
        <div className="register-panel__inner">
          <h1 className="register-heading">Confirm Email Change</h1>
          <p className="register-subtext">
            Confirming this will make the new address your login email going forward.
          </p>

          {!token ? (
            <div className="register-server-error" role="alert">
              This confirmation link is missing its token.
            </div>
          ) : null}
          {serverError ? <div className="register-server-error" role="alert">{serverError}</div> : null}

          {confirmedEmail ? (
            <>
              <div className="register-note">
                Your account email is now {confirmedEmail}. You can keep using your current session.
              </div>
              <div className="register-switch">
                <Link className="register-switch__btn" to="/settings">
                  Back to Settings
                </Link>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="register-submit"
              disabled={!token || isSubmitting}
              onClick={handleConfirm}
            >
              {isSubmitting ? "Confirming..." : "Confirm Email Change"}
            </button>
          )}

          <div className="register-switch">
            <Link className="register-switch__btn" to="/settings">
              Back to Settings
            </Link>
          </div>

          <div className="register-footer">Nexis - Shard: Cay</div>
        </div>
      </div>
    </div>
  );
}
