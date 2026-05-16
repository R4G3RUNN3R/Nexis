import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../lib/authApi";
import "../styles/register.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required.";
  if (!EMAIL_PATTERN.test(trimmed)) return "Enter a valid email address.";
  return null;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const emailError = touched ? validateEmail(email) : null;
  const isValid = validateEmail(email) === null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setServerError(null);
    if (!isValid) return;
    setIsSubmitting(true);

    try {
      const result = await requestPasswordReset({ email: email.trim() });
      if (!result.ok) {
        setServerError(result.error ?? "Password reset request failed.");
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
          <span className="register-hero__sub">Password Recovery</span>
        </div>
      </div>

      <div className="register-panel" role="main">
        <div className="register-panel__inner">
          <h1 className="register-heading">Reset Your Password</h1>
          <p className="register-subtext">
            Enter your account email and we&apos;ll send a reset link. Assuming the mail
            server is configured and not currently communing with the void.
          </p>

          {serverError ? (
            <div className="register-server-error" role="alert">{serverError}</div>
          ) : null}

          {isSubmitted ? (
            <>
              <div className="register-note">
                If that account exists, a password reset email is on its way. Either way,
                we keep the response deliberately vague so strangers do not get a free
                account directory.
              </div>
              <div className="register-switch">
                <Link className="register-switch__btn" to="/login">
                  Back to login
                </Link>
              </div>
            </>
          ) : (
            <form className="register-form" onSubmit={handleSubmit} noValidate>
              <div className="register-field">
                <label className="register-label" htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  className={`register-input${emailError ? " register-input--error" : ""}`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (!touched) setTouched(true);
                  }}
                  onBlur={() => setTouched(true)}
                  autoComplete="email"
                  autoFocus
                />
                {emailError ? <p className="register-error" role="alert">{emailError}</p> : null}
              </div>

              <button
                type="submit"
                className="register-submit"
                disabled={isSubmitting || (!isValid && touched)}
              >
                {isSubmitting ? "Sending Reset Link..." : "Send Reset Link"}
              </button>
            </form>
          )}

          <div className="register-switch">
            Remembered it after all?{" "}
            <Link className="register-switch__btn" to="/login">
              Return to login
            </Link>
          </div>

          <div className="register-footer">Nexis - Shard: Cay</div>
        </div>
      </div>
    </div>
  );
}
