import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import "../styles/register.css";

const NAME_MIN = 2;
const NAME_MAX = 20;
const NAME_PATTERN = /^[a-zA-Z\- ']+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 6;

type AuthPageProps = {
  initialMode?: "register" | "login";
};

function getRedirectTarget(state: unknown): string {
  if (
    typeof state === "object" &&
    state !== null &&
    "redirectedFrom" in state &&
    typeof (state as { redirectedFrom?: unknown }).redirectedFrom === "string"
  ) {
    const redirectedFrom = (state as { redirectedFrom: string }).redirectedFrom;
    if (redirectedFrom === "/app.html" || redirectedFrom === "/login" || redirectedFrom === "/register") {
      return "/home";
    }
    return redirectedFrom;
  }

  return "/home";
}

function validateName(name: string, fieldLabel: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN) return `${fieldLabel} must be at least ${NAME_MIN} characters.`;
  if (trimmed.length > NAME_MAX) return `${fieldLabel} must be ${NAME_MAX} characters or fewer.`;
  if (!NAME_PATTERN.test(trimmed)) return `${fieldLabel} may only contain letters, hyphens, and apostrophes.`;
  return null;
}

function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required.";
  if (!EMAIL_PATTERN.test(trimmed)) return "Enter a valid email address.";
  return null;
}

function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  return null;
}

function RegisterForm({ onSwitch, redirectTarget }: { onSwitch: () => void; redirectTarget: string }) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function touch(field: string) {
    setTouched((previous) => ({ ...previous, [field]: true }));
  }

  const firstErr = touched.first ? validateName(firstName, "First name") : null;
  const lastErr = touched.last ? validateName(lastName, "Last name") : null;
  const emailErr = touched.email ? validateEmail(email) : null;
  const passErr = touched.password ? validatePassword(password) : null;
  const confirmErr = touched.confirm && password !== confirmPassword ? "Passwords do not match." : null;

  const isValid =
    validateName(firstName, "First name") === null &&
    validateName(lastName, "Last name") === null &&
    validateEmail(email) === null &&
    validatePassword(password) === null &&
    password === confirmPassword;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched({ first: true, last: true, email: true, password: true, confirm: true });
    setServerError(null);
    if (!isValid) return;
    setIsSubmitting(true);

    try {
      const result = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      });

      if (!result.ok) {
        setServerError(result.error ?? "Registration failed.");
        return;
      }

      navigate(redirectTarget, { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="register-heading">Create Your Account</h1>
      <p className="register-subtext">
        Build a permanent Nexis identity and enter the shard immediately.
      </p>

      {serverError ? <div className="register-server-error" role="alert">{serverError}</div> : null}

      <form className="register-form" onSubmit={handleSubmit} noValidate>
        <div className="register-row">
          <div className="register-field">
            <label className="register-label" htmlFor="first-name">First Name</label>
            <input
              id="first-name"
              type="text"
              className={`register-input${firstErr ? " register-input--error" : ""}`}
              placeholder="e.g. Gareth"
              value={firstName}
              maxLength={NAME_MAX + 4}
              onChange={(event) => { setFirstName(event.target.value); if (!touched.first) touch("first"); }}
              onBlur={() => touch("first")}
              autoComplete="given-name"
              autoFocus
            />
            {firstErr ? <p className="register-error" role="alert">{firstErr}</p> : null}
          </div>

          <div className="register-field">
            <label className="register-label" htmlFor="last-name">Last Name</label>
            <input
              id="last-name"
              type="text"
              className={`register-input${lastErr ? " register-input--error" : ""}`}
              placeholder="e.g. Ashveil"
              value={lastName}
              maxLength={NAME_MAX + 4}
              onChange={(event) => { setLastName(event.target.value); if (!touched.last) touch("last"); }}
              onBlur={() => touch("last")}
              autoComplete="family-name"
            />
            {lastErr ? <p className="register-error" role="alert">{lastErr}</p> : null}
          </div>
        </div>

        <div className="register-field">
          <label className="register-label" htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            type="email"
            className={`register-input${emailErr ? " register-input--error" : ""}`}
            placeholder="you@example.com"
            value={email}
            onChange={(event) => { setEmail(event.target.value); if (!touched.email) touch("email"); }}
            onBlur={() => touch("email")}
            autoComplete="email"
          />
          {emailErr ? <p className="register-error" role="alert">{emailErr}</p> : null}
        </div>

        <div className="register-field">
          <label className="register-label" htmlFor="reg-password">Password</label>
          <input
            id="reg-password"
            type="password"
            className={`register-input${passErr ? " register-input--error" : ""}`}
            placeholder="Min. 6 characters"
            value={password}
            onChange={(event) => { setPassword(event.target.value); if (!touched.password) touch("password"); }}
            onBlur={() => touch("password")}
            autoComplete="new-password"
          />
          {passErr ? <p className="register-error" role="alert">{passErr}</p> : null}
        </div>

        <div className="register-field">
          <label className="register-label" htmlFor="reg-confirm">Confirm Password</label>
          <input
            id="reg-confirm"
            type="password"
            className={`register-input${confirmErr ? " register-input--error" : ""}`}
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(event) => { setConfirmPassword(event.target.value); if (!touched.confirm) touch("confirm"); }}
            onBlur={() => touch("confirm")}
            autoComplete="new-password"
          />
          {confirmErr ? <p className="register-error" role="alert">{confirmErr}</p> : null}
        </div>

        <div className="register-note">
          Your account receives a permanent public citizen ID on creation. It never changes and is never reused.
        </div>

        <button
          type="submit"
          className="register-submit"
          disabled={isSubmitting || (!isValid && Object.keys(touched).length > 0)}
        >
          {isSubmitting ? "Creating Account..." : "Create Account"}
        </button>
      </form>

      <div className="register-switch">
        Already have an account?{" "}
        <button type="button" className="register-switch__btn" onClick={onSwitch} disabled={isSubmitting}>
          Log In
        </button>
      </div>

      <div className="register-footer">Nexis &mdash; Shard: Cay</div>
    </>
  );
}

function LoginForm({ onSwitch, redirectTarget }: { onSwitch: () => void; redirectTarget: string }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailErr = touched.email ? validateEmail(email) : null;
  const passErr = touched.password && !password ? "Password is required." : null;
  const isValid = validateEmail(email) === null && password.length > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched({ email: true, password: true });
    setServerError(null);
    if (!isValid) return;
    setIsSubmitting(true);

    try {
      const result = await login(email.trim(), password);
      if (!result.ok) {
        setServerError(result.error ?? "Login failed.");
        return;
      }

      navigate(redirectTarget, { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="register-heading">Welcome Back</h1>
      <p className="register-subtext">
        Sign in with your Nexis account and return to the shard.
      </p>

      {serverError ? <div className="register-server-error" role="alert">{serverError}</div> : null}

      <form className="register-form" onSubmit={handleSubmit} noValidate>
        <div className="register-field">
          <label className="register-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            className={`register-input${emailErr ? " register-input--error" : ""}`}
            placeholder="you@example.com"
            value={email}
            onChange={(event) => { setEmail(event.target.value); if (!touched.email) setTouched((prev) => ({ ...prev, email: true })); }}
            onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
            autoComplete="email"
            autoFocus
          />
          {emailErr ? <p className="register-error" role="alert">{emailErr}</p> : null}
        </div>

        <div className="register-field">
          <label className="register-label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            className={`register-input${passErr ? " register-input--error" : ""}`}
            placeholder="Your password"
            value={password}
            onChange={(event) => { setPassword(event.target.value); if (!touched.password) setTouched((prev) => ({ ...prev, password: true })); }}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
            autoComplete="current-password"
          />
          {passErr ? <p className="register-error" role="alert">{passErr}</p> : null}
        </div>

        <button
          type="submit"
          className="register-submit"
          disabled={isSubmitting || (!isValid && Object.keys(touched).length > 0)}
        >
          {isSubmitting ? "Signing In..." : "Log In"}
        </button>
      </form>

      <div className="register-switch">
        Don&apos;t have an account?{" "}
        <button type="button" className="register-switch__btn" onClick={onSwitch} disabled={isSubmitting}>
          Create Account
        </button>
      </div>

      <div className="register-footer">Nexis &mdash; Shard: Cay</div>
    </>
  );
}

export default function RegisterPage({ initialMode = "register" }: AuthPageProps) {
  const [mode, setMode] = useState<"register" | "login">(initialMode);
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTarget = getRedirectTarget(location.state);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (isLoggedIn) {
      navigate(redirectTarget, { replace: true });
    }
  }, [isLoggedIn, navigate, redirectTarget]);

  function goToLogin() {
    navigate("/login", { replace: true, state: location.state });
  }

  function goToRegister() {
    navigate("/register", { replace: true, state: location.state });
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
          <span className="register-hero__sub">Online Realm of Adventure</span>
        </div>
      </div>

      <div className="register-panel" role="main">
        <div className="register-panel__inner">
          {mode === "register" ? (
            <RegisterForm onSwitch={goToLogin} redirectTarget={redirectTarget} />
          ) : (
            <LoginForm onSwitch={goToRegister} redirectTarget={redirectTarget} />
          )}
        </div>
      </div>
    </div>
  );
}
