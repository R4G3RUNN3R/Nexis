import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { usePlayer } from "../state/PlayerContext";
import { allocatePublicNumericId, formatEntityPublicId } from "../lib/publicIds";
import "../styles/guild.css";

type GuildMember = {
  publicId: number | null;
  name: string;
  role: string;
};

type GuildBoard = {
  kind: "guild";
  publicId: number;
  name: string;
  tag: string;
  founderPublicId: number | null;
  createdAt: number;
  treasury: number;
  respect: number;
  raidCount: number;
  recruitmentOpen: boolean;
  members: GuildMember[];
};

type ConsortiumEmployee = {
  publicId: number | null;
  name: string;
  role: string;
  efficiency: number;
};

type ConsortiumBoard = {
  kind: "consortium";
  publicId: number;
  name: string;
  tag: string;
  founderPublicId: number | null;
  createdAt: number;
  vault: number;
  stars: number;
  employees: ConsortiumEmployee[];
  applicantCount: number;
  advertisingLevel: number;
};

const GUILD_STORAGE_PREFIX = "nexis_guild_board_";
const CONSORTIUM_STORAGE_PREFIX = "nexis_consortium_board_";

function guildKey(internalId: string) {
  return `${GUILD_STORAGE_PREFIX}${internalId}`;
}

function consortiumKey(internalId: string) {
  return `${CONSORTIUM_STORAGE_PREFIX}${internalId}`;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function collectExistingPublicIds(prefix: string): number[] {
  if (typeof window === "undefined") return [];
  const ids: number[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? "null") as { publicId?: number } | null;
      if (parsed && typeof parsed.publicId === "number") {
        ids.push(parsed.publicId);
      }
    } catch {
      // ignore broken entries
    }
  }
  return ids;
}

function formatDate(timestamp: number) {
  try {
    return new Date(timestamp).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Unknown";
  }
}

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  );
}

export default function GuildPage() {
  const { player, spendGold } = usePlayer();
  const [guildBoard, setGuildBoard] = useState<GuildBoard | null>(null);
  const [consortiumBoard, setConsortiumBoard] = useState<ConsortiumBoard | null>(null);
  const [guildName, setGuildName] = useState("");
  const [guildTag, setGuildTag] = useState("");
  const [consortiumName, setConsortiumName] = useState("");
  const [consortiumTag, setConsortiumTag] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const displayName = player.lastName ? `${player.name} ${player.lastName}` : player.name || "Unknown";
  const hasGuildCharter = (player.inventory["guild_charter"] ?? 0) > 0;
  const hasConsortiumWrit = (player.inventory["consortium_writ"] ?? 0) > 0;
  const guildCost = hasGuildCharter ? 50000 : 150000;
  const consortiumCost = hasConsortiumWrit ? 75000 : 200000;
  const canFound = player.level >= 10;

  useEffect(() => {
    setGuildBoard(readJson<GuildBoard>(guildKey(player.internalId)));
    setConsortiumBoard(readJson<ConsortiumBoard>(consortiumKey(player.internalId)));
  }, [player.internalId]);

  const canCreateGuild = useMemo(() => {
    return !guildBoard && canFound && player.gold >= guildCost && guildName.trim().length >= 3 && guildTag.trim().length >= 2;
  }, [guildBoard, canFound, player.gold, guildCost, guildName, guildTag]);

  const canCreateConsortium = useMemo(() => {
    return !consortiumBoard && canFound && player.gold >= consortiumCost && consortiumName.trim().length >= 3 && consortiumTag.trim().length >= 2;
  }, [consortiumBoard, canFound, player.gold, consortiumCost, consortiumName, consortiumTag]);

  function createGuild() {
    if (!canCreateGuild) return;
    const paid = spendGold(guildCost);
    if (!paid) {
      setMessage("Not enough gold to found a guild.");
      return;
    }
    const publicId = allocatePublicNumericId("guild", collectExistingPublicIds(GUILD_STORAGE_PREFIX));
    const board: GuildBoard = {
      kind: "guild",
      publicId,
      name: guildName.trim(),
      tag: guildTag.trim().toUpperCase().slice(0, 6),
      founderPublicId: player.publicId,
      createdAt: Date.now(),
      treasury: 0,
      respect: 100,
      raidCount: 0,
      recruitmentOpen: true,
      members: [
        {
          publicId: player.publicId,
          name: displayName,
          role: "Guildmaster",
        },
      ],
    };
    writeJson(guildKey(player.internalId), board);
    setGuildBoard(board);
    setGuildName("");
    setGuildTag("");
    setMessage(`Guild founded: ${board.name} [${formatEntityPublicId("guild", board.publicId)}]`);
  }

  function createConsortium() {
    if (!canCreateConsortium) return;
    const paid = spendGold(consortiumCost);
    if (!paid) {
      setMessage("Not enough gold to found a consortium.");
      return;
    }
    const publicId = allocatePublicNumericId("consortium", collectExistingPublicIds(CONSORTIUM_STORAGE_PREFIX));
    const board: ConsortiumBoard = {
      kind: "consortium",
      publicId,
      name: consortiumName.trim(),
      tag: consortiumTag.trim().toUpperCase().slice(0, 6),
      founderPublicId: player.publicId,
      createdAt: Date.now(),
      vault: 0,
      stars: 1,
      employees: [
        {
          publicId: player.publicId,
          name: displayName,
          role: "Director",
          efficiency: 100,
        },
      ],
      applicantCount: 0,
      advertisingLevel: 1,
    };
    writeJson(consortiumKey(player.internalId), board);
    setConsortiumBoard(board);
    setConsortiumName("");
    setConsortiumTag("");
    setMessage(`Consortium founded: ${board.name} [${formatEntityPublicId("consortium", board.publicId)}]`);
  }

  return (
    <AppShell
      title="Guilds & Consortiums"
      hint="Found, manage, and grow cooperative guilds or economic consortiums. Both now have visible creation flow and persistent public IDs."
    >
      <div style={{ display: "grid", gap: 16 }}>
        {message ? (
          <section className="panel">
            <div className="panel__body">
              <strong>{message}</strong>
            </div>
          </section>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          <section className="panel">
            <div className="panel__header"><h2>Guild</h2></div>
            <div className="panel__body" style={{ display: "grid", gap: 12 }}>
              {guildBoard ? (
                <>
                  <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
                    <strong>{guildBoard.name} [{formatEntityPublicId("guild", guildBoard.publicId)}]</strong>
                    <div style={{ color: "#9fb0bf", fontSize: 13 }}>Tag: {guildBoard.tag} • Founded: {formatDate(guildBoard.createdAt)}</div>
                    <StatusRow label="Respect" value={guildBoard.respect} />
                    <StatusRow label="Treasury" value={`${guildBoard.treasury.toLocaleString("en-GB")} gold`} />
                    <StatusRow label="Raid Count" value={guildBoard.raidCount} />
                    <StatusRow label="Recruitment" value={guildBoard.recruitmentOpen ? "Open" : "Closed"} />
                  </div>
                  <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
                    <strong>Members</strong>
                    {guildBoard.members.map((member) => (
                      <div key={`${member.name}-${member.role}`} className="info-row">
                        <span className="info-row__label">{member.role}</span>
                        <span className="info-row__value">{member.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ color: "#9fb0bf", fontSize: 13 }}>Found a cooperative guild for raids, prestige, shared storage, and member progression.</div>
                  <StatusRow label="Requirement" value="Level 10+" />
                  <StatusRow label="Founding Cost" value={`${guildCost.toLocaleString("en-GB")} gold`} />
                  <StatusRow label="Guild Charter" value={hasGuildCharter ? "Present" : "Missing"} />
                  <input value={guildName} onChange={(e) => setGuildName(e.target.value)} placeholder="Guild name" />
                  <input value={guildTag} onChange={(e) => setGuildTag(e.target.value)} placeholder="Guild tag" />
                  <button type="button" disabled={!canCreateGuild} onClick={createGuild}>Create Guild</button>
                </>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header"><h2>Consortium</h2></div>
            <div className="panel__body" style={{ display: "grid", gap: 12 }}>
              {consortiumBoard ? (
                <>
                  <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
                    <strong>{consortiumBoard.name} [{formatEntityPublicId("consortium", consortiumBoard.publicId)}]</strong>
                    <div style={{ color: "#9fb0bf", fontSize: 13 }}>Tag: {consortiumBoard.tag} • Founded: {formatDate(consortiumBoard.createdAt)}</div>
                    <StatusRow label="Stars" value={consortiumBoard.stars} />
                    <StatusRow label="Vault" value={`${consortiumBoard.vault.toLocaleString("en-GB")} gold`} />
                    <StatusRow label="Applicants" value={consortiumBoard.applicantCount} />
                    <StatusRow label="Advertising" value={`Level ${consortiumBoard.advertisingLevel}`} />
                  </div>
                  <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
                    <strong>Employees</strong>
                    {consortiumBoard.employees.map((employee) => (
                      <div key={`${employee.name}-${employee.role}`} className="info-row">
                        <span className="info-row__label">{employee.role}</span>
                        <span className="info-row__value">{employee.name} • Efficiency {employee.efficiency}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ color: "#9fb0bf", fontSize: 13 }}>Found an economic consortium for employees, upgrades, vault growth, and star ranking.</div>
                  <StatusRow label="Requirement" value="Level 10+" />
                  <StatusRow label="Founding Cost" value={`${consortiumCost.toLocaleString("en-GB")} gold`} />
                  <StatusRow label="Consortium Writ" value={hasConsortiumWrit ? "Present" : "Missing"} />
                  <input value={consortiumName} onChange={(e) => setConsortiumName(e.target.value)} placeholder="Consortium name" />
                  <input value={consortiumTag} onChange={(e) => setConsortiumTag(e.target.value)} placeholder="Consortium tag" />
                  <button type="button" disabled={!canCreateConsortium} onClick={createConsortium}>Create Consortium</button>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
