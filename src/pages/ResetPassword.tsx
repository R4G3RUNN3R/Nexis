import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { submitPasswordReset } from "../lib/authApi";
import "../styles/register.css";

const PASSWORD_MIN = 6;

function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  return null;
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const passwordError = touched.password ? validatePassword(password) : null;
  const confirmError =
    touched.confirm && password !== confirmPassword ? "Passwords do not match." : null;
  const tokenError = token ? null : "This reset link is missing its token.";
  const isValid =
    Boolean(token) &&
    validatePassword(password) === null &&
    password === confirmPassword;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched({ password: true, confirm: true });
    setServerError(null);
    if (!isValid) return;
    setIsSubmitting(true);

    try {
      const result = await submitPasswordReset({ token, password });
      if (!result.ok) {
        setServerError(result.error ?? "Password reset failed.");
        return;
      }

      setIsSubmitted(true);
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
          <span className="register-hero__sub">Choose a New Password</span>
        </div>
      </div>

      <div className="register-panel" role="main">
        <div className="register-panel__inner">
          <h1 className="register-heading">Set a New Password</h1>
          <p className="register-subtext">
            This replaces your old password and signs out existing sessions. A little
            scorched-earth, but in this case the earth had it coming.
          </p>

          {tokenError ? <div className="register-server-error" role="alert">{tokenError}</div> : null}
          {serverError ? <div className="register-server-error" role="alert">{serverError}</div> : null}

          {isSubmitted ? (
            <>
              <div className="register-note">
                Your password has been reset successfully. You can log in now with the
                new one and carry on being dramatically powerful.
              </div>
              <div className="register-switch">
                <Link className="register-switch__btn" to="/login">
                  Go to login
                </Link>
              </div>
            </>
          ) : (
            <form className="register-form" onSubmit={handleSubmit} noValidate>
              <div className="register-field">
                <label className="register-label" htmlFor="reset-password">New Password</label>
                <input
                  id="reset-password"
                  type="password"
                  className={`register-input${passwordError ? " register-input--error" : ""}`}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (!touched.password) {
                      setTouched((previous) => ({ ...previous, password: true }));
                    }
                  }}
                  onBlur={() => setTouched((previous) => ({ ...previous, password: true }))}
                  autoComplete="new-password"
                  autoFocus
                  disabled={!token}
                />
                {passwordError ? <p className="register-error" role="alert">{passwordError}</p> : null}
              </div>

              <div className="register-field">
                <label className="register-label" htmlFor="reset-confirm-password">Confirm Password</label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  className={`register-input${confirmError ? " register-input--error" : ""}`}
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    if (!touched.confirm) {
                      setTouched((previous) => ({ ...previous, confirm: true }));
                    }
                  }}
                  onBlur={() => setTouched((previous) => ({ ...previous, confirm: true }))}
                  autoComplete="new-password"
                  disabled={!token}
                />
                {confirmError ? <p className="register-error" role="alert">{confirmError}</p> : null}
              </div>

              <button
                type="submit"
                className="register-submit"
                disabled={!token || isSubmitting || (!isValid && Object.keys(touched).length > 0)}
              >
                {isSubmitting ? "Resetting Password..." : "Reset Password"}
              </button>
            </form>
          )}

          <div className="register-switch">
            <Link className="register-switch__btn" to="/login">
              Back to login
            </Link>
          </div>

          <div className="register-footer">Nexis - Shard: Cay</div>
        </div>
      </div>
    </div>
  );
}
