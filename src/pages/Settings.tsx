import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { useNewsTickerPreference } from "../lib/uiPreferences";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";
import { getProfileRoute } from "../lib/publicIds";
import {
  changeName,
  changePassword,
  closeAccount,
  requestEmailChange,
  saveCurrentServerState,
} from "../lib/authApi";
import {
  applySidebarLinkOrder,
  SIDEBAR_SECTIONS,
  sidebarLinkKey,
  type SidebarLinksPreference,
  type SidebarSectionId,
} from "../data/sidebarCatalog";

type SettingsCategoryKey =
  | "general"
  | "security"
  | "attack"
  | "icons"
  | "navigation"
  | "email-subs"
  | "api-keys"
  | "change-name"
  | "change-email"
  | "change-password"
  | "change-gender"
  | "profile-signature"
  | "forum-signature"
  | "uploaded-images"
  | "self-exclusion"
  | "close-account";

type SettingsCategory = { key: SettingsCategoryKey; label: string; kind: "real" | "placeholder"; reason?: string };

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { key: "general", label: "General settings", kind: "real" },
  { key: "security", label: "Security settings", kind: "placeholder", reason: "Nexis has no revive-permission or alternate-navigation-mode systems yet - this section is reserved for when it does." },
  { key: "attack", label: "Attack settings", kind: "placeholder", reason: "Nexis combat doesn't track per-weapon durability, reload state, or stealthing yet - there's nothing here to configure." },
  { key: "icons", label: "Icon settings", kind: "placeholder", reason: "Nexis doesn't have a customizable personal status-icon system yet." },
  { key: "navigation", label: "Navigation settings", kind: "real" },
  { key: "email-subs", label: "Email subscriptions", kind: "placeholder", reason: "Nexis can send account mail, but there's no newsletter or digest subscription system built yet - nothing to opt in or out of." },
  { key: "api-keys", label: "API Keys", kind: "placeholder", reason: "Nexis doesn't expose a public third-party API yet, so there's nothing an API key would grant access to." },
  { key: "change-name", label: "Change name", kind: "real" },
  { key: "change-email", label: "Change email", kind: "real" },
  { key: "change-password", label: "Change password", kind: "real" },
  { key: "change-gender", label: "Change gender", kind: "placeholder", reason: "Nothing in Nexis reads a gender field yet - no pronoun logic, no gendered titles or dialogue - so there's nothing this setting would actually change." },
  { key: "profile-signature", label: "Profile Signature", kind: "placeholder", reason: "Nexis has no forum, so there's nowhere a signature would appear." },
  { key: "forum-signature", label: "Forum Signature", kind: "placeholder", reason: "Nexis has no forum, so there's nowhere a signature would appear." },
  { key: "uploaded-images", label: "Uploaded Images", kind: "real" },
  { key: "self-exclusion", label: "Self-exclusion", kind: "placeholder", reason: "Nexis has no casino or gambling systems, so there's nothing to self-exclude from." },
  { key: "close-account", label: "Close Account", kind: "real" },
];

function PlaceholderPanel({ category }: { category: SettingsCategory }) {
  return (
    <ContentPanel title={category.label}>
      <div className="info-row">
        <span className="info-row__label">Not available yet</span>
        <span className="info-row__value">{category.reason ?? "This section is not part of Nexis yet."}</span>
      </div>
    </ContentPanel>
  );
}

function GeneralSettingsPanel() {
  const { serverSessionToken, refreshServerState } = useAuth();
  const { player } = usePlayer();
  const [newsTickerEnabled, setNewsTickerEnabled] = useNewsTickerPreference();
  const prefs = (player as unknown as { preferences?: { compactMode?: string; reducedMotion?: string } }).preferences;
  const [busyPref, setBusyPref] = useState<string | null>(null);

  async function togglePreference(key: "compactMode" | "reducedMotion", currentValue: boolean) {
    if (!serverSessionToken) return;
    setBusyPref(key);
    try {
      await saveCurrentServerState(serverSessionToken, { player: { preferences: { [key]: currentValue ? "false" : "true" } } });
      await refreshServerState();
    } finally {
      setBusyPref(null);
    }
  }

  return (
    <ContentPanel title="General settings">
      <div className="info-list">
        <div className="info-row">
          <span className="info-row__label">News Ticker</span>
          <span className="info-row__value">
            <button type="button" className="settings-toggle" onClick={() => setNewsTickerEnabled(!newsTickerEnabled)}>
              {newsTickerEnabled ? "On" : "Off"}
            </button>
          </span>
        </div>
        <div className="info-row">
          <span className="info-row__label">Compact mode</span>
          <span className="info-row__value">
            <button type="button" className="settings-toggle" disabled={busyPref === "compactMode"} onClick={() => togglePreference("compactMode", prefs?.compactMode === "true")}>
              {prefs?.compactMode === "true" ? "On" : "Off"}
            </button>
          </span>
        </div>
        <div className="info-row">
          <span className="info-row__label">Reduced motion</span>
          <span className="info-row__value">
            <button type="button" className="settings-toggle" disabled={busyPref === "reducedMotion"} onClick={() => togglePreference("reducedMotion", prefs?.reducedMotion === "true")}>
              {prefs?.reducedMotion === "true" ? "On" : "Off"}
            </button>
          </span>
        </div>
      </div>
    </ContentPanel>
  );
}

function NavigationSectionEditor({
  section,
  title,
  saved,
  onChange,
}: {
  section: SidebarSectionId;
  title: string;
  saved: string[] | undefined;
  onChange: (section: SidebarSectionId, keys: string[]) => void;
}) {
  const catalog = SIDEBAR_SECTIONS[section];
  const currentKeys = saved && saved.length ? saved : catalog.map((entry) => sidebarLinkKey(entry.route));
  const hiddenEntries = catalog.filter((entry) => !currentKeys.includes(sidebarLinkKey(entry.route)));

  function move(index: number, direction: -1 | 1) {
    const next = [...currentKeys];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(section, next);
  }

  function hide(key: string) {
    onChange(section, currentKeys.filter((entry) => entry !== key));
  }

  function show(key: string) {
    onChange(section, [...currentKeys, key]);
  }

  return (
    <div className="settings-nav-editor">
      <strong>{title}</strong>
      <div className="settings-nav-editor__list">
        {currentKeys.map((key, index) => {
          const entry = catalog.find((candidate) => sidebarLinkKey(candidate.route) === key);
          if (!entry) return null;
          return (
            <div key={key} className="settings-nav-editor__row">
              <span>{entry.label}</span>
              <div className="settings-nav-editor__row-actions">
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>Up</button>
                <button type="button" disabled={index === currentKeys.length - 1} onClick={() => move(index, 1)}>Down</button>
                <button type="button" onClick={() => hide(key)}>Hide</button>
              </div>
            </div>
          );
        })}
      </div>
      {hiddenEntries.length ? (
        <div className="settings-nav-editor__hidden">
          <span>Hidden</span>
          {hiddenEntries.map((entry) => (
            <button key={entry.route} type="button" onClick={() => show(sidebarLinkKey(entry.route))}>
              Show {entry.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NavigationSettingsPanel() {
  const { serverSessionToken, refreshServerState } = useAuth();
  const { player } = usePlayer();
  const saved = (player as unknown as { ui?: { sidebarLinks?: SidebarLinksPreference } }).ui?.sidebarLinks;
  const [pending, setPending] = useState<SidebarLinksPreference | null>(null);
  const [busy, setBusy] = useState(false);

  const effective = pending ?? saved ?? {};

  function updateSection(section: SidebarSectionId, keys: string[]) {
    setPending({ ...effective, [section]: keys });
  }

  async function handleSave() {
    if (!serverSessionToken || !pending) return;
    setBusy(true);
    try {
      // Sends the complete sidebarLinks object every time (all three
      // sections), not just the one edited - the server merges ui.* as a
      // whole key, so a partial payload here would wipe out any other
      // section's saved customization.
      await saveCurrentServerState(serverSessionToken, { player: { ui: { sidebarLinks: pending } } });
      await refreshServerState();
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    setPending({ character: [], realm: [], orders: [] });
  }

  return (
    <ContentPanel title="Navigation settings">
      <p className="settings-hint">Choose which sidebar links show up and in what order. Hospital, jail, and travel still hide relevant links automatically regardless of this setting.</p>
      <NavigationSectionEditor section="character" title="Character" saved={effective.character} onChange={updateSection} />
      <NavigationSectionEditor section="realm" title="Realm" saved={effective.realm} onChange={updateSection} />
      <NavigationSectionEditor section="orders" title="Orders" saved={effective.orders} onChange={updateSection} />
      <div className="settings-actions">
        <button type="button" className="settings-submit" disabled={!pending || busy} onClick={handleSave}>
          {busy ? "Saving..." : "Save Navigation Settings"}
        </button>
        <button type="button" className="settings-link-btn" onClick={handleReset}>Reset to default</button>
      </div>
    </ContentPanel>
  );
}

function ChangePasswordPanel() {
  const { serverSessionToken, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (!serverSessionToken) return;
    setBusy(true);
    const result = await changePassword(serverSessionToken, { currentPassword, newPassword });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    logout();
    navigate("/login", { state: { notice: "Password changed. Please log in again." } });
  }

  return (
    <ContentPanel title="Change password">
      <form className="settings-form" onSubmit={handleSubmit}>
        {error ? <div className="settings-error">{error}</div> : null}
        <label className="settings-field">
          <span>Current password (leave blank if you sign in with Google)</span>
          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
        </label>
        <label className="settings-field">
          <span>New password</span>
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
        </label>
        <label className="settings-field">
          <span>Confirm new password</span>
          <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
        </label>
        <button type="submit" className="settings-submit" disabled={busy}>{busy ? "Changing..." : "Change Password"}</button>
        <p className="settings-hint">This signs you out of every device, including this one.</p>
      </form>
    </ContentPanel>
  );
}

function ChangeEmailPanel() {
  const { serverSessionToken } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!serverSessionToken) return;
    setBusy(true);
    const result = await requestEmailChange(serverSessionToken, { newEmail });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  return (
    <ContentPanel title="Change email">
      {sent ? (
        <div className="info-row">
          <span className="info-row__label">Check your inbox</span>
          <span className="info-row__value">A confirmation link was sent to {newEmail}. Your account email won't change until you click it.</span>
        </div>
      ) : (
        <form className="settings-form" onSubmit={handleSubmit}>
          {error ? <div className="settings-error">{error}</div> : null}
          <label className="settings-field">
            <span>New email address</span>
            <input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} autoComplete="email" />
          </label>
          <button type="submit" className="settings-submit" disabled={busy}>{busy ? "Requesting..." : "Send Confirmation Link"}</button>
        </form>
      )}
    </ContentPanel>
  );
}

function ChangeNamePanel() {
  const { serverSessionToken, refreshServerState } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!serverSessionToken) return;
    setBusy(true);
    const result = await changeName(serverSessionToken, { firstName, lastName });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(`Renamed to ${result.user.firstName} ${result.user.lastName}. ${result.goldSpent.toLocaleString("en-GB")} gold spent.`);
    await refreshServerState();
  }

  return (
    <ContentPanel title="Change name">
      <p className="settings-hint">Renaming costs 2,500 gold and can only be done once every 30 days. 2-20 characters, letters/hyphens/spaces/apostrophes only.</p>
      <form className="settings-form" onSubmit={handleSubmit}>
        {error ? <div className="settings-error">{error}</div> : null}
        {message ? <div className="settings-note">{message}</div> : null}
        <label className="settings-field">
          <span>First name</span>
          <input type="text" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        </label>
        <label className="settings-field">
          <span>Last name</span>
          <input type="text" value={lastName} onChange={(event) => setLastName(event.target.value)} />
        </label>
        <button type="submit" className="settings-submit" disabled={busy}>{busy ? "Renaming..." : "Change Name"}</button>
      </form>
    </ContentPanel>
  );
}

function CloseAccountPanel() {
  const { serverSessionToken, logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (confirmPhrase.trim().toUpperCase() !== "CLOSE MY ACCOUNT") {
      setError('Type "CLOSE MY ACCOUNT" exactly to confirm.');
      return;
    }
    if (!serverSessionToken) return;
    setBusy(true);
    const result = await closeAccount(serverSessionToken, { password: password || undefined });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    logout();
    navigate("/login", { state: { notice: "Your account has been closed." } });
  }

  return (
    <ContentPanel title="Close Account">
      <div className="settings-error" style={{ marginBottom: 12 }}>
        Closing your account signs you out everywhere and blocks future logins. This cannot be undone from here.
      </div>
      <form className="settings-form" onSubmit={handleSubmit}>
        {error ? <div className="settings-error">{error}</div> : null}
        <label className="settings-field">
          <span>Current password (leave blank if you sign in with Google)</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        </label>
        <label className="settings-field">
          <span>Type CLOSE MY ACCOUNT to confirm</span>
          <input type="text" value={confirmPhrase} onChange={(event) => setConfirmPhrase(event.target.value)} />
        </label>
        <button type="submit" className="settings-submit settings-submit--danger" disabled={busy}>{busy ? "Closing..." : "Close Account"}</button>
      </form>
    </ContentPanel>
  );
}

function UploadedImagesPanel() {
  const { player } = usePlayer();
  const profileRoute = getProfileRoute(player.publicId);
  return (
    <ContentPanel title="Uploaded Images">
      <div className="info-row">
        <span className="info-row__label">Portrait</span>
        <span className="info-row__value">
          Manage your portrait from <Link className="inline-route-link" to={profileRoute}>your profile</Link>.
        </span>
      </div>
    </ContentPanel>
  );
}

export default function SettingsPage() {
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryKey>("general");
  const active = SETTINGS_CATEGORIES.find((entry) => entry.key === activeCategory) ?? SETTINGS_CATEGORIES[0];

  return (
    <AppShell title="Settings" hint="Account, display, and navigation preferences.">
      <div className="settings-layout">
        <nav className="settings-nav">
          {SETTINGS_CATEGORIES.map((category) => (
            <button
              key={category.key}
              type="button"
              className={`settings-nav__item${category.key === activeCategory ? " settings-nav__item--active" : ""}`}
              onClick={() => setActiveCategory(category.key)}
            >
              {category.label}
            </button>
          ))}
        </nav>
        <div className="settings-body">
          {active.kind === "placeholder" ? (
            <PlaceholderPanel category={active} />
          ) : active.key === "general" ? (
            <GeneralSettingsPanel />
          ) : active.key === "navigation" ? (
            <NavigationSettingsPanel />
          ) : active.key === "change-password" ? (
            <ChangePasswordPanel />
          ) : active.key === "change-email" ? (
            <ChangeEmailPanel />
          ) : active.key === "change-name" ? (
            <ChangeNamePanel />
          ) : active.key === "close-account" ? (
            <CloseAccountPanel />
          ) : active.key === "uploaded-images" ? (
            <UploadedImagesPanel />
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
