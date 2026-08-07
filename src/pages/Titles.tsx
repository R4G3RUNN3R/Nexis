import { useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";
import { formatPlayerPublicId } from "../lib/publicIds";
import { getProfileView, setOwnProfileTitle, type ProfileResponse } from "../lib/profileApi";
import { equipOwnTitle, getOwnTitles, unequipOwnTitle, type TitleCatalogEntry } from "../lib/titleApi";

export default function TitlesPage() {
  const { activeAccount, serverSessionToken, refreshServerState } = useAuth();
  const { player } = usePlayer();

  const [titles, setTitles] = useState<TitleCatalogEntry[]>([]);
  const [titlesLoading, setTitlesLoading] = useState(true);
  const [titlesError, setTitlesError] = useState<string | null>(null);
  const [titleActionPendingId, setTitleActionPendingId] = useState<string | null>(null);

  const [prestige, setPrestige] = useState<ProfileResponse["publicProfile"]["prestige"] | null>(null);
  const [prestigeLoading, setPrestigeLoading] = useState(true);
  const [prestigeMessage, setPrestigeMessage] = useState<string | null>(null);
  const [prestigeError, setPrestigeError] = useState<string | null>(null);

  const ownPublicId = activeAccount?.publicId ?? player.publicId;

  useEffect(() => {
    let cancelled = false;

    async function loadTitles() {
      if (!serverSessionToken) {
        setTitles([]);
        setTitlesLoading(false);
        return;
      }
      setTitlesLoading(true);
      const result = await getOwnTitles(serverSessionToken);
      if (cancelled) return;
      setTitlesLoading(false);
      if (!result.ok) {
        setTitlesError(result.error);
        return;
      }
      setTitlesError(null);
      setTitles(result.titles);
    }

    void loadTitles();
    return () => {
      cancelled = true;
    };
  }, [serverSessionToken]);

  useEffect(() => {
    let cancelled = false;

    async function loadPrestige() {
      if (!ownPublicId) {
        setPrestigeLoading(false);
        return;
      }
      setPrestigeLoading(true);
      const result = await getProfileView(formatPlayerPublicId(ownPublicId), serverSessionToken);
      if (cancelled) return;
      setPrestigeLoading(false);
      if (!result.ok) return;
      setPrestige(result.profile.publicProfile.prestige ?? null);
    }

    void loadPrestige();
    return () => {
      cancelled = true;
    };
  }, [ownPublicId, serverSessionToken]);

  async function handleTitleChoice(titleId: string) {
    setPrestigeMessage(null);
    setPrestigeError(null);
    const result = await setOwnProfileTitle(titleId, serverSessionToken);
    if (!result.ok) {
      setPrestigeError(result.error);
      return;
    }
    setPrestige(result.prestige);
    setPrestigeMessage(result.message ?? "Title updated.");
    await refreshServerState();
  }

  async function handleEquipTitle(titleId: string) {
    setTitleActionPendingId(titleId);
    setTitlesError(null);
    const result = await equipOwnTitle(titleId, serverSessionToken);
    setTitleActionPendingId(null);
    if (!result.ok) {
      setTitlesError(result.error);
      return;
    }
    setTitles(result.titles);
    await refreshServerState();
  }

  async function handleUnequipTitle() {
    setTitleActionPendingId("__unequip__");
    setTitlesError(null);
    const result = await unequipOwnTitle(serverSessionToken);
    setTitleActionPendingId(null);
    if (!result.ok) {
      setTitlesError(result.error);
      return;
    }
    setTitles(result.titles);
    await refreshServerState();
  }

  return (
    <AppShell title="Titles" hint="Every distinction and title Nexis tracks, earned or not, with what it takes to unlock each one.">
      <ContentPanel title="Titles">
        <div className="profile-panel-summary">
          <span>{titles.filter((title) => title.earned).length} / {titles.length} earned</span>
        </div>

        {titlesLoading ? (
          <div className="profile-empty-note">Syncing titles...</div>
        ) : titlesError ? (
          <div className="profile-empty-note">{titlesError}</div>
        ) : titles.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {titles.some((title) => title.equipped) ? (
              <button type="button" onClick={() => void handleUnequipTitle()} disabled={titleActionPendingId !== null}>
                {titleActionPendingId === "__unequip__" ? "Clearing..." : "Clear Equipped Title"}
              </button>
            ) : null}
            {titles.map((title) => (
              <article
                key={title.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: 10,
                  background: title.equipped ? "rgba(255,255,255,0.04)" : "transparent",
                  opacity: title.earned ? 1 : 0.6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong>{title.name}</strong>
                  <span style={{ fontSize: 12, textTransform: "uppercase", opacity: 0.8 }}>
                    {title.kind === "stat" ? "Stat-affecting" : "Cosmetic"}
                  </span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.76, margin: "4px 0" }}>{title.description}</div>
                <p style={{ margin: "6px 0", opacity: 0.82 }}>{title.flavor}</p>
                {title.effects.length ? (
                  <ul style={{ margin: "6px 0", paddingLeft: 18 }}>
                    {title.effects.map((effect) => (
                      <li key={`${title.id}-${effect}`}>{effect}</li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.6, margin: "6px 0" }}>No stat effect (cosmetic).</div>
                )}
                {title.earned ? (
                  <button
                    type="button"
                    disabled={title.equipped || titleActionPendingId !== null}
                    onClick={() => void handleEquipTitle(title.id)}
                  >
                    {title.equipped ? "Equipped" : titleActionPendingId === title.id ? "Equipping..." : "Equip"}
                  </button>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.6 }}>Not yet earned.</div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="profile-empty-note">No titles recorded yet.</div>
        )}
      </ContentPanel>

      <ContentPanel title="Distinctions">
        <div className="profile-panel-summary">
          <span>Current: {prestige?.currentTitle?.label ?? "Citizen"}</span>
        </div>

        {prestigeLoading ? (
          <div className="profile-empty-note">Syncing distinctions...</div>
        ) : prestige?.catalog?.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {prestige.catalog.map((entry) => (
              <article
                key={entry.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: 10,
                  background: prestige.currentTitle?.id === entry.id ? "rgba(255,255,255,0.04)" : "transparent",
                  opacity: entry.unlocked ? 1 : 0.6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong>{entry.label}</strong>
                  <span style={{ fontSize: 12, textTransform: "uppercase", opacity: 0.8 }}>
                    {entry.unlocked ? "Unlocked" : "Locked"}
                  </span>
                </div>
                {entry.summary ? <p style={{ margin: "6px 0", opacity: 0.82 }}>{entry.summary}</p> : null}
                {entry.unlocked ? (
                  <button
                    type="button"
                    disabled={prestige.currentTitle?.id === entry.id}
                    onClick={() => void handleTitleChoice(entry.id)}
                  >
                    {prestige.currentTitle?.id === entry.id ? "Equipped" : "Set as current"}
                  </button>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.6 }}>Not yet unlocked.</div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="profile-empty-note">No distinctions recorded yet.</div>
        )}
        {prestigeMessage ? <div className="profile-empty-note">{prestigeMessage}</div> : null}
        {prestigeError ? <div className="profile-empty-note">{prestigeError}</div> : null}
      </ContentPanel>
    </AppShell>
  );
}
