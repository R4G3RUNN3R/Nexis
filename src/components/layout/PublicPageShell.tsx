import { Link, NavLink } from "react-router-dom";
import { ReactNode } from "react";

const supportLinks: Array<[string, string]> = [
  ["News", "/news"],
  ["Rules", "/rules"],
  ["Contact", "/contact"],
  ["Credits", "/credits"],
];

type PublicPageShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export default function PublicPageShell({ title, subtitle, children }: PublicPageShellProps) {
  return (
    <div className="public-shell">
      <header className="public-topbar">
        <div className="public-topbar__brand">
          <Link to="/" className="public-topbar__logo">Ashen Crown</Link>
          <span className="public-topbar__tag">Browser fantasy realm</span>
        </div>

        <nav className="public-topbar__nav" aria-label="Public navigation">
          <NavLink to="/" className={({ isActive }) => `public-topbar__link${isActive ? " public-topbar__link--active" : ""}`} end>
            Home
          </NavLink>
          {supportLinks.map(([label, to]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `public-topbar__link${isActive ? " public-topbar__link--active" : ""}`}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="public-topbar__actions">
          <Link to="/register" className="public-topbar__button public-topbar__button--accent">Register</Link>
          <Link to="/login" className="public-topbar__button">Login</Link>
        </div>
      </header>

      <main className="public-main">
        <section className="public-hero">
          <div className="public-hero__eyebrow">Ashen Crown Gazette</div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </section>

        <section className="public-content">{children}</section>
      </main>

      <footer className="public-footer">
        <div>Ashen Crown public records</div>
        <div className="public-footer__links">
          <Link to="/rules">Rules</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/credits">Credits</Link>
        </div>
      </footer>
    </div>
  );
}
