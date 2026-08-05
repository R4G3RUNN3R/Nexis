import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { PlayerAvatar } from "../components/common/PlayerAvatar";
import { usePlayer } from "../state/PlayerContext";
import { useEducation, formatRemaining } from "../state/EducationContext";
import { educationCourseMap } from "../data/educationData";
import { useAuth } from "../state/AuthContext";
import { formatEntityPublicId, formatPlayerNameWithPublicId, getProfileRoute } from "../lib/publicIds";
import { formatTravelDuration, getCityName, getTravelProgress, readTravelStateFromPlayer } from "../lib/travelState";
import { getProfileView } from "../lib/profileApi";
import { getLegacyAchievements, getServerItemInventory, type ServerEquipmentSlot, type ServerInventoryEntry } from "../lib/authApi";
import { resolveDisplayTitle } from "../lib/titleAccess";
import { getPropertyById, getPropertyComfortCap, propertyTiers } from "../data/propertyData";
import { getLifePath } from "../data/lifePathsData";
import { CommandBrief } from "../components/onboarding/CommandBrief";
import { getPlayerCommandBrief, type PlayerCommandBrief } from "../lib/playerGuideApi";
import CielSpotlightTutorial from "../components/ciel/CielSpotlightTutorial";
import { RankedRibbonIcon, RisingRankIcon } from "../assets/icons";
function Row({ label, value }: { label: string; value: React.ReactNode }) { return <div className="info-row"><span className="info-row__label">{label}</span><span className="info-row__value">{value}</span></div>; }
function formatLabel(value: string | null | undefined) { return value ? value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown"; }
function ActionLink({ label, to, disabledReason }: { label: string; to: string; disabledReason?: string | null }) { return <div className="home-action"><div className="home-action__copy"><strong>{label}</strong></div>{disabledReason ? <span className="home-action__lock" title={disabledReason}>Locked</span> : <Link className="home-action__link" to={to}>Open</Link>}</div>; }
type AcademyStudySnapshot = { academyId?: string; stageId?: string; cityId?: string; startedAt?: number; endsAt?: number };
type LegacySnapshot = { available: number; earned: number; spent: number; honors: number; medals: number; latest: string | null };
type PortraitHolder = { portrait?: { imageUrl?: string | null; imageKey?: string | null; hasCustomImage?: boolean } | null };
type ItemsSummarySnapshot = { inventory: ServerInventoryEntry[]; equipment: ServerEquipmentSlot[]; equipmentSlots: string[] };
export default function HomePage() {
  const { player, isHospitalized, hospitalRemainingLabel, isJailed, jailRemainingLabel } = usePlayer();
  const { activeAccount, authSource, serverSessionToken, serverHydrationVersion } = useAuth();
  const education = useEducation();
  const displayName = player.lastName ? `${player.name} ${player.lastName}` : player.name || "Unknown";
  const displayPublicId = activeAccount?.publicId ?? player.publicId;
  const displayNameWithPublicId = formatPlayerNameWithPublicId(displayName, displayPublicId);
  const displayTitle = resolveDisplayTitle(player.title, displayPublicId);
  const profileRoute = getProfileRoute(displayPublicId);
  const travelState = readTravelStateFromPlayer(player);
  const travelProgress = getTravelProgress(travelState, Date.now());
  const isTraveling = travelProgress.active;
  const currentEducationName = education.activeCourse ? educationCourseMap[education.activeCourse.courseId]?.name ?? formatLabel(education.activeCourse.courseId) : "No active education";
  const currentEducationHint = education.activeCourse ? formatRemaining(education.getRemainingMs()) : "Ready for a course";
  const academyStudy = (((player as unknown as { cityAcademy?: { activeStudy?: AcademyStudySnapshot | null } }).cityAcademy)?.activeStudy ?? null);
  const academyStudyName = academyStudy ? `${formatLabel(academyStudy.academyId)}: ${formatLabel(academyStudy.stageId)}` : "No active academy study";
  const academyStudyHint = academyStudy?.endsAt ? `${getCityName(academyStudy.cityId as never)} | ${formatRemaining(Math.max(0, academyStudy.endsAt - Date.now()))}` : "Ready for city study";
  const livePlayer = player as unknown as {
    shadow?: { current?: number; max?: number; label?: string; nextAt?: number | null };
    worldLoops?: { dailyLogin?: { streak?: number; claimedToday?: boolean; behavior?: string }; returnSummary?: { entries?: Array<{ id?: string; label?: string; route?: string }> }; cityRhythm?: { rhythm?: { title?: string; summary?: string }; update?: { title?: string; summary?: string }; threat?: { title?: string; severity?: number | string; summary?: string }; boss?: { title?: string; name?: string; status?: string; reward?: string } } };
    notifications?: { alerts?: Array<{ id?: string; label?: string; route?: string; type?: string }> };
    prestige?: { distinctions?: string[] };
    records?: { entries?: Array<{ id?: string; timestamp?: number; category?: string; summary?: string; route?: string | null }> };
  };
  const lifePathState = (player as unknown as { lifePath?: { current: string | null; chosenAt: number | null } }).lifePath ?? null;
  const chosenLifePath = getLifePath(lifePathState?.current ?? null);
  const dailyLogin = livePlayer.worldLoops?.dailyLogin;
  const returnEntries = livePlayer.worldLoops?.returnSummary?.entries ?? [];
  const liveAlerts = livePlayer.notifications?.alerts ?? [];
  const recentRecords = (livePlayer.records?.entries ?? []).slice(0, 4);
  const [orgSummary, setOrgSummary] = useState({ guild: "Unaffiliated", consortium: "Independent" });
  const [legacySnapshot, setLegacySnapshot] = useState<LegacySnapshot | null>(null);
  const [itemsSummary, setItemsSummary] = useState<ItemsSummarySnapshot | null>(null);
  const [commandBrief, setCommandBrief] = useState<PlayerCommandBrief | null>(null);
  useEffect(() => { let cancelled = false; async function loadOrgSummary() { if (authSource !== "server" || !serverSessionToken) { setOrgSummary({ guild: "Unaffiliated", consortium: "Independent" }); return; } const resolvedPublicId = activeAccount?.publicId ?? player.publicId; if (!resolvedPublicId) return; const profile = await getProfileView(formatEntityPublicId("player", resolvedPublicId), serverSessionToken); if (cancelled) return; if (!profile.ok) { setOrgSummary({ guild: "Unavailable", consortium: "Unavailable" }); return; } const guild = profile.profile.publicProfile.guild; const consortium = profile.profile.publicProfile.consortium; setOrgSummary({ guild: guild ? `${guild.name} [${formatEntityPublicId("guild", guild.publicId)}]` : "Unaffiliated", consortium: consortium ? `${consortium.name} [${formatEntityPublicId("consortium", consortium.publicId)}]` : "Independent" }); } void loadOrgSummary(); return () => { cancelled = true; }; }, [activeAccount?.publicId, authSource, player.publicId, serverSessionToken]);
  useEffect(() => { let cancelled = false; async function loadLegacySnapshot() { if (authSource !== "server" || !serverSessionToken) { setLegacySnapshot(null); return; } const result = await getLegacyAchievements(serverSessionToken); if (cancelled) return; if (!result.ok) return; const completed = result.achievements.filter((achievement) => achievement.completed || achievement.progress >= achievement.target); setLegacySnapshot({ available: result.legacyPoints.available, earned: result.legacyPoints.totalEarned, spent: result.legacyPoints.totalSpent, honors: completed.filter((achievement) => (achievement.kind ?? "honor") === "honor").length, medals: completed.filter((achievement) => achievement.kind === "medal").length, latest: result.newlyAwarded[0]?.name ?? null }); } void loadLegacySnapshot(); return () => { cancelled = true; }; }, [authSource, serverHydrationVersion, serverSessionToken]);
  useEffect(() => { let cancelled = false; async function loadItemsSummary() { if (authSource !== "server" || !serverSessionToken) { setItemsSummary(null); return; } const result = await getServerItemInventory(serverSessionToken); if (cancelled) return; if (!result.ok) return; setItemsSummary({ inventory: result.inventory, equipment: result.equipment, equipmentSlots: result.equipmentSlots }); } void loadItemsSummary(); return () => { cancelled = true; }; }, [authSource, serverHydrationVersion, serverSessionToken]);
  useEffect(() => { let cancelled = false; async function loadCommandBrief() { if (authSource !== "server" || !serverSessionToken) { setCommandBrief(null); return; } const result = await getPlayerCommandBrief(serverSessionToken); if (cancelled) return; setCommandBrief(result.ok ? result.commandBrief : null); } void loadCommandBrief(); return () => { cancelled = true; }; }, [authSource, serverHydrationVersion, serverSessionToken]);
  const actionLockReason = isTraveling ? `Unavailable while traveling. Arrival in ${formatTravelDuration(travelProgress.remainingMs)}.` : isHospitalized ? `Unavailable while hospitalized. Recovery in ${hospitalRemainingLabel}.` : isJailed ? `Unavailable while jailed. Release in ${jailRemainingLabel}.` : null;
  const travelStatus = travelProgress.active ? `${getCityName(travelState.originCityId)} to ${getCityName(travelState.destinationCityId)} | ${formatTravelDuration(travelProgress.remainingMs)}` : `In ${getCityName(travelState.currentCityId)}`;
  const conditionLabel = isHospitalized ? `Hospitalized for ${hospitalRemainingLabel}` : isJailed ? `Jailed for ${jailRemainingLabel}` : isTraveling ? `In caravan for ${formatTravelDuration(travelProgress.remainingMs)}` : "Ready for orders";
  const quickActions = [
    ["City", "/city"], ["Travel", "/travel"], ["Education", "/education"], ["Skills", "/skills"], ["Inventory", "/inventory"], ["Adventure", "/adventure"],
  ];
  const workingTotal = player.workingStats.manualLabor + player.workingStats.intelligence + player.workingStats.endurance;
  const battleTotal = player.battleStats.strength + player.battleStats.defense + player.battleStats.speed + player.battleStats.dexterity;
  const currentPropertyTier = getPropertyById(player.property.current) ?? propertyTiers[0];
  const propertyComfortCap = getPropertyComfortCap(currentPropertyTier.id, player.property.installedUpgrades);
  const inventoryEntries = itemsSummary?.inventory ?? [];
  const inventoryItemTotal = inventoryEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  const inventoryEstValue = inventoryEntries.reduce((sum, entry) => sum + entry.quantity * (entry.item?.valueSell ?? 0), 0);
  const equippedSlots = itemsSummary?.equipment.filter((slot) => slot.itemId) ?? [];
  const notices = useMemo(() => {
    const items: Array<{ id: string; label: string; to?: string }> = [];
    if (education.activeCourse && education.getRemainingMs() <= 0) items.push({ id: "course-ready", label: "Education course ready to complete", to: "/education" });
    if (academyStudy?.endsAt && academyStudy.endsAt <= Date.now()) items.push({ id: "academy-ready", label: "Academy study ready to complete", to: "/city#academy" });
    if (travelProgress.active && travelProgress.remainingMs <= 0) items.push({ id: "travel-arrival", label: "Travel arrival ready", to: "/travel" });
    if (legacySnapshot?.available) items.push({ id: "legacy-points", label: `${legacySnapshot.available} Legacy Point${legacySnapshot.available === 1 ? "" : "s"} ready to spend`, to: "/achievements" });
    if (legacySnapshot?.latest) items.push({ id: "legacy-latest", label: `New honor or medal: ${legacySnapshot.latest}`, to: "/achievements" });
    if (player.stats.energy < 25) items.push({ id: "low-energy", label: "Low energy blocks real fights" });
    if (player.stats.health <= Math.ceil(player.stats.maxHealth * 0.25)) items.push({ id: "low-health", label: "Low health may block risky actions" });
    for (const alert of liveAlerts.slice(0, 4)) items.push({ id: `alert-${alert.id ?? alert.label}`, label: alert.label ?? "World notice", to: alert.route });
    for (const entry of returnEntries.slice(0, 4)) items.push({ id: `return-${entry.id ?? entry.label}`, label: entry.label ?? "Return update", to: entry.route });
    if (!items.length) items.push({ id: "ready", label: "Ready for orders" });
    return items;
  }, [academyStudy?.endsAt, education, legacySnapshot, liveAlerts, player.stats.energy, player.stats.health, player.stats.maxHealth, returnEntries, travelProgress.active, travelProgress.remainingMs]);
  const portrait = (player as unknown as PortraitHolder).portrait;
  return <AppShell title="Home" hint="Compact command center: identity, current activity, quick actions, progression, and readiness."><CielSpotlightTutorial /><div className="home-surface"><section className="home-hero"><div className="home-hero__identity"><PlayerAvatar name={player.name} lastName={player.lastName} portrait={portrait} size={56} className="home-hero__crest" /><div className="home-hero__copy"><div className="home-hero__eyebrow">Citizen command</div><h1>{displayNameWithPublicId}</h1><div className="home-hero__meta"><span>{displayTitle || "Untitled citizen"}</span><span>Level {player.level}</span><span>{getCityName(travelState.currentCityId)}</span><span>{conditionLabel}</span></div></div></div><div className="home-hero__actions"><Link className="home-hero__action home-hero__action--primary" to={profileRoute}>Profile</Link><Link className="home-hero__action" to="/achievements">Legacy</Link></div></section>{!chosenLifePath ? <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", border: "1px solid #6a5a2f", background: "#171410", padding: "10px 14px", marginBottom: 14 }}><span style={{ fontSize: 12, color: "#dde5ef", lineHeight: 1.5 }}>New citizen? Choose a Life Path to flavor your early missions, suggested first job, and suggested first study.</span><Link to="/life-paths" style={{ fontSize: 12, fontWeight: 700, color: "#f5e6b8", border: "1px solid #6a5a2f", background: "#3d3319", padding: "8px 14px", whiteSpace: "nowrap" }}>Choose your Life Path</Link></div> : null}<CommandBrief brief={commandBrief} /><div className="home-grid"><div className="home-grid__main"><ContentPanel title="Current Activity" className="panel--heroic"><div className="info-list"><Row label="Current Education" value={`${currentEducationName} | ${currentEducationHint}`} /><Row label="Current Academy Study" value={`${academyStudyName} | ${academyStudyHint}`} /><Row label="Travel" value={travelStatus} />{dailyLogin ? <Row label="Daily Streak" value={`${dailyLogin.streak ?? 0} days | ${dailyLogin.claimedToday ? "claimed" : "ready"}`} /> : null}<Row label="Active Contract" value={player.current.job ?? "No active contract"} /><Row label="Life Path" value={chosenLifePath ? <Link className="inline-route-link" to="/life-paths">{`${chosenLifePath.name} — try ${chosenLifePath.suggestedJob.label} or study ${chosenLifePath.suggestedEducation.label}`}</Link> : <Link className="inline-route-link" to="/life-paths">Not chosen yet — pick your Life Path</Link>} />{orgSummary.guild !== "Unaffiliated" ? <Row label="Guild" value={orgSummary.guild} /> : null}{orgSummary.consortium !== "Independent" ? <Row label="Consortium" value={orgSummary.consortium} /> : null}</div></ContentPanel><ContentPanel title="Quick Actions"><div className="home-actions-grid">{quickActions.map(([label, to]) => <ActionLink key={label} label={label} to={to} disabledReason={actionLockReason} />)}</div></ContentPanel><ContentPanel title="Progression Snapshot"><div className="info-list" style={{ marginBottom: 10 }}><Row label="Working total" value={workingTotal.toLocaleString("en-GB")} /><Row label="Battle total" value={battleTotal.toLocaleString("en-GB")} /><Row label="Legacy Points" value={legacySnapshot ? `${legacySnapshot.available} available | ${legacySnapshot.earned} earned` : "Server sync required"} /><Row label="Honors / Medals" value={legacySnapshot ? `${legacySnapshot.honors} honors | ${legacySnapshot.medals} medals` : "0 honors | 0 medals"} /></div><details><summary style={{ cursor: "pointer", color: "#d8c278", fontWeight: 700 }}>Working stats detail</summary><div className="info-list" style={{ marginTop: 10 }}><Row label="Manual Labor" value={player.workingStats.manualLabor} /><Row label="Intelligence" value={player.workingStats.intelligence} /><Row label="Endurance" value={player.workingStats.endurance} /></div></details><details style={{ marginTop: 12 }}><summary style={{ cursor: "pointer", color: "#d8c278", fontWeight: 700 }}>Battle stats detail</summary><div className="info-list" style={{ marginTop: 10 }}><Row label="Strength" value={player.battleStats.strength} /><Row label="Defense" value={player.battleStats.defense} /><Row label="Speed" value={player.battleStats.speed} /><Row label="Dexterity" value={player.battleStats.dexterity} /></div></details></ContentPanel></div><div className="home-grid__rail"><ContentPanel title="Notifications / Readiness"><div className="info-list">{notices.slice(0, 6).map((notice) => <Row key={notice.id} label="Notice" value={notice.to ? <Link className="inline-route-link" to={notice.to}>{notice.label}</Link> : notice.label} />)}</div></ContentPanel><ContentPanel title="Assets"><div className="info-list"><Row label="Property" value={`${currentPropertyTier.icon} ${currentPropertyTier.name} | ${propertyComfortCap} comfort`} /><Row label="Inventory" value={itemsSummary ? `${inventoryItemTotal.toLocaleString("en-GB")} items | ${inventoryEstValue.toLocaleString("en-GB")} gold est.` : "Server sync required"} /><Row label="Equipment" value={itemsSummary ? `${equippedSlots.length} / ${itemsSummary.equipmentSlots.length} slots equipped` : "Server sync required"} /><Row label="Manage" value={<><Link className="inline-route-link" to="/housing">Housing</Link>{" | "}<Link className="inline-route-link" to="/inventory">Inventory</Link></>} /></div></ContentPanel><ContentPanel title="Recent Records"><div className="info-list">{recentRecords.length ? recentRecords.map((record) => <Row key={record.id ?? record.summary} label={formatLabel(record.category)} value={record.route ? <Link className="inline-route-link" to={record.route}>{record.summary ?? "Account record"}</Link> : record.summary ?? "Account record"} />) : <Row label="Records" value="No major records yet" />}</div></ContentPanel><ContentPanel title="Vote for Nexis"><p className="home-vote__copy">Vote for us to help our community grow!</p><div className="home-vote__links"><a className="home-vote__link" href="https://www.apexwebgaming.net/details/nexis/vote" target="_blank" rel="noopener noreferrer" title="Vote for Nexis on Apex Web Gaming"><RankedRibbonIcon size={22} /><span>Apex Web Gaming</span></a><a className="home-vote__link" href="https://www.topwebgames.com/game/nexis" target="_blank" rel="noopener noreferrer" title="Vote for Nexis on Top Web Games"><RisingRankIcon size={22} /><span>Top Web Games</span></a></div></ContentPanel></div></div></div></AppShell>;
}
