import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { usePlayer } from "../state/PlayerContext";
import { useAuth } from "../state/AuthContext";
import { mergeServerStateIntoCache } from "../lib/runtimeStateCache";
import { formatEntityPublicId } from "../lib/publicIds";
import { createOrganization, getMyOrganization } from "../lib/organizationApi";
import { formatDate, readGuildBoard, type GuildBoard } from "../lib/organizations";
import { cielPageCopy } from "../data/cielPageCopy";
import "../styles/guild.css";

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="info-row"><span className="info-row__label">{label}</span><span className="info-row__value">{value}</span></div>;
}

function refreshPlayerCache(email: string, user: { internalPlayerId: string; publicId: number; firstName: string; lastName: string }, playerState: Parameters<typeof mergeServerStateIntoCache>[0]["playerState"]) {
  mergeServerStateIntoCache({ email, user, playerState });
  window.dispatchEvent(new CustomEvent("nexis:player-refresh"));
}

export default function GuildsPage() {
  const { player } = usePlayer();
  const { activeAccount, authSource, serverSessionToken } = useAuth();
  const [board, setBoard] = useState<GuildBoard | null>(null);
  const [guildName, setGuildName] = useState("");
  const [guildTag, setGuildTag] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const hasGuildCharter = (player.inventory.guild_charter ?? 0) > 0;
  const foundingCost = hasGuildCharter ? 50000 : 150000;
  const pageCopy = cielPageCopy.guilds;

  useEffect(() => {
    if (authSource === "server" && serverSessionToken) {
      void getMyOrganization(serverSessionToken, "guild").then((result) => {
        if ("ok" in result && result.ok === false) {
          setMessage(result.error);
          return;
        }
        setBoard((result as { organization: GuildBoard | null }).organization);
      });
      return;
    }
    setBoard(readGuildBoard(player.internalId));
  }, [authSource, player.internalId, serverSessionToken]);

  const guildBlockReason = useMemo(() => {
    if (board) return "You already run a guild on this character.";
    if (guildName.trim().length < 3) return "Guild name must be at least 3 characters.";
    if (guildTag.trim().length < 2) return "Guild tag must be at least 2 characters.";
    if (player.gold < foundingCost) return `You need ${(foundingCost - player.gold).toLocaleString("en-GB")} more gold.`;
    return null;
  }, [board, guildName, guildTag, player.gold, foundingCost]);

  async function createGuild() {
    if (guildBlockReason) return;
    if (authSource === "server" && activeAccount && serverSessionToken) {
      const result = await createOrganization(serverSessionToken, { type: "guild", name: guildName.trim(), tag: guildTag.trim() });
      if ("ok" in result && result.ok === false) {
        setMessage(result.error);
        return;
      }
      const payload = result as { organization: GuildBoard; playerState: Parameters<typeof mergeServerStateIntoCache>[0]["playerState"] };
      setBoard(payload.organization);
      setGuildName("");
      setGuildTag("");
      refreshPlayerCache(activeAccount.email, {
        internalPlayerId: activeAccount.internalPlayerId,
        publicId: activeAccount.publicId,
        firstName: activeAccount.firstName,
        lastName: activeAccount.lastName,
      }, payload.playerState);
      setMessage(`Guild founded: ${payload.organization.name} [${formatEntityPublicId("guild", payload.organization.publicId)}]`);
      return;
    }

    setMessage("Guild creation now expects the live server path. Local fallback was intentionally not expanded.");
  }

  return (
    <AppShell title="Guilds" hint={pageCopy.flavor}>
      <div style={{ display: "grid", gap: 16 }}>
        <div className="page-intro-grid">
          <ContentPanel title="Guild Flavor">
            <p className="page-intro__lead">{pageCopy.flavor}</p>
            <p className="page-intro__body">{pageCopy.alt}</p>
          </ContentPanel>
          <ContentPanel title="CIEL">
            <p className="page-intro__body">{pageCopy.ciel}</p>
          </ContentPanel>
        </div>

        {message ? <section className="panel"><div className="panel__body"><strong>{message}</strong></div></section> : null}
        <section className="panel">
          <div className="panel__header"><h2>Guild Command Board</h2></div>
          <div className="panel__body" style={{ display: "grid", gap: 12 }}>
            {board ? (
              <>
                <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
                  <strong>{board.name} [{formatEntityPublicId("guild", board.publicId)}]</strong>
                  <div style={{ color: "#9fb0bf", fontSize: 13 }}>Tag: {board.tag} | Founded: {formatDate(board.createdAt)} | Status: {board.statusText}</div>
                  <StatusRow label="Treasury" value={`${board.treasury.gold.toLocaleString("en-GB")} gold`} />
                  <StatusRow label="Roles" value={board.roles.length} />
                  <StatusRow label="Members" value={board.members.length} />
                  <div style={{ fontSize: 12, color: "#b7c3cf" }}>{board.description}</div>
                </div>
                <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
                  <strong>Members</strong>
                  {board.members.map((member) => (
                    <div key={`${member.userInternalId}-${member.roleKey}`} className="info-row">
                      <span className="info-row__label">{member.roleKey}</span>
                      <span className="info-row__value">{member.displayName}</span>
                    </div>
                  ))}
                </div>
                <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
                  <strong>Future Scope</strong>
                  <div style={{ fontSize: 13, color: "#9fb0bf" }}>Guild wars, sieges, strongholds, guild skills, and reputation are intentionally held for later so this foundation stays stable.</div>
                </div>
              </>
            ) : (
              <>
                <div style={{ color: "#9fb0bf", fontSize: 13 }}>Guilds are Ashen Crown social and combat organizations. This pass gives them a real shared backend core, founder roles, membership records, and logs without pretending wars are finished.</div>
                <StatusRow label="Requirement" value="Name, tag, and founding funds" />
                <StatusRow label="Founding Cost" value={`${foundingCost.toLocaleString("en-GB")} gold`} />
                <StatusRow label="Guild Charter" value={hasGuildCharter ? "Present" : "Missing"} />
                <div className="org-form">
                  <input className="org-input" value={guildName} onChange={(event) => setGuildName(event.target.value)} placeholder="Guild name" />
                  <input className="org-input" value={guildTag} onChange={(event) => setGuildTag(event.target.value)} placeholder="Guild tag" />
                  <button type="button" className="org-button" disabled={guildBlockReason !== null} onClick={createGuild}>Create Guild</button>
                </div>
                <div style={{ fontSize: 12, color: guildBlockReason ? "#d98f8f" : "#8ec8a7" }}>{guildBlockReason ?? "Founding this guild will create a real shared organization record immediately."}</div>
              </>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
