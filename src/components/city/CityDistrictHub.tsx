import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ContentPanel } from "../layout/ContentPanel";
import { getCityDistricts } from "../../data/cityDistricts";
import { getCityHubContent, type CityService } from "../../data/cityHubData";
import { getCityAcademyDetail, getCityLocalContracts } from "../../data/cityLoopData";
import { type WorldCity } from "../../data/worldMapData";
import { getProfileRoute } from "../../lib/publicIds";
import { getServerCityPeople, type ServerCityOccupant, type ServerCityPopulation } from "../../lib/authApi";
import { useAuth } from "../../state/AuthContext";

function ServiceLink({ service }: { service: CityService }) {
  const statusLabel = service.status === "open" ? "Open" : service.status === "locked" ? "Locked" : "Unavailable";
  const body = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <strong>{service.label}</strong>
        <span style={{ fontSize: 12, color: service.status === "open" ? "#d8c278" : "#d98f8f" }}>{statusLabel}</span>
      </div>
      <div style={{ fontSize: 13, color: "#b7c3cf" }}>{service.summary}</div>
      {service.status !== "open" && service.lockReason ? <div style={{ fontSize: 12, color: "#d0ad74" }}>{service.lockReason}</div> : null}
    </>
  );

  const style = {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: 12,
    background: "rgba(7, 13, 20, 0.55)",
    display: "grid",
    gap: 8,
    textDecoration: "none",
    color: "inherit",
  } as const;

  if (service.status === "open" && service.route) {
    return (
      <Link to={service.route} className="inline-route-link" style={style}>
        {body}
      </Link>
    );
  }

  return <div style={style}>{body}</div>;
}

function PeopleList({
  people,
  population,
  loading,
  error,
}: {
  people: ServerCityOccupant[];
  population: ServerCityPopulation | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <div style={{ color: "#9fb0bf", fontSize: 13 }}>Checking local presence...</div>;
  if (error) return <div style={{ color: "#d98f8f", fontSize: 13 }}>{error}</div>;

  const visibleCount = population?.visibleCount ?? people.length;
  const peopleLabel = population?.peopleLabel ?? "citizens";

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: "rgba(7, 13, 20, 0.45)", display: "grid", gap: 4 }}>
        <div className="info-row"><span className="info-row__label">Visible population</span><span className="info-row__value">{visibleCount} {peopleLabel}</span></div>
        <div className="info-row"><span className="info-row__label">Guildmates present</span><span className="info-row__value">{population?.guildmatesVisible ?? 0}</span></div>
        <div className="info-row"><span className="info-row__label">Consortium peers present</span><span className="info-row__value">{population?.consortiumMembersVisible ?? 0}</span></div>
      </div>
      {!people.length ? <div style={{ color: "#9fb0bf", fontSize: 13 }}>No visible citizens are listed in this city right now.</div> : null}
      {people.map((person) => (
        <Link
          key={person.publicId}
          to={getProfileRoute(person.publicId)}
          className="inline-route-link"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: 10,
            display: "grid",
            gap: 4,
            color: "inherit",
            textDecoration: "none",
            background: person.isSelf ? "rgba(216,194,120,0.08)" : "rgba(7, 13, 20, 0.48)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <strong>{person.displayName}</strong>
            <span style={{ color: "#d8c278", fontSize: 12 }}>{person.isSelf ? "You" : `P${person.publicId}`}</span>
          </div>
          <div style={{ color: "#9fb0bf", fontSize: 12 }}>{person.title} | Level {person.level}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11, color: "#d0ad74" }}>
            {person.sharesGuild ? <span>Guildmate</span> : null}
            {person.sharesConsortium ? <span>Consortium peer</span> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function CityDistrictHub({ city }: { city: WorldCity }) {
  const { authSource, serverSessionToken } = useAuth();
  const hub = useMemo(() => getCityHubContent(city.id), [city.id]);
  const academyDetail = useMemo(() => getCityAcademyDetail(city.id), [city.id]);
  const localContracts = useMemo(() => getCityLocalContracts(city.id), [city.id]);
  const districts = getCityDistricts(city);
  const [people, setPeople] = useState<ServerCityOccupant[]>([]);
  const [population, setPopulation] = useState<ServerCityPopulation | null>(null);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [peopleLoading, setPeopleLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPeople() {
      if (authSource !== "server" || !serverSessionToken) {
        setPeople([]);
        setPopulation(null);
        setPeopleError("Sign in through the live server session to view city presence.");
        return;
      }

      setPeopleLoading(true);
      setPeopleError(null);
      const result = await getServerCityPeople(serverSessionToken, city.id);
      if (cancelled) return;
      setPeopleLoading(false);
      if (!("ok" in result) || !result.ok) {
        setPeople([]);
        setPopulation(null);
        setPeopleError(result.error);
        return;
      }
      setPeople(result.people);
      setPopulation(result.population);
    }

    void loadPeople();
    return () => {
      cancelled = true;
    };
  }, [authSource, city.id, serverSessionToken]);

  const openServiceCards = [hub.services.market, hub.services.travel, hub.services.consortium, hub.services.guild];
  const localServiceCards = [hub.services.blackMarket, hub.services.citySpecial, hub.services.academy];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: 14,
          background: "rgba(7, 13, 20, 0.58)",
          display: "grid",
          gap: 6,
        }}
      >
        <strong>{hub.displayName}</strong>
        <div style={{ color: "#d8c278", fontSize: 13 }}>{hub.identity}</div>
        <div style={{ color: "#9fb0bf", fontSize: 13 }}>{hub.overview}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <ContentPanel title="City Overview">
          <div style={{ display: "grid", gap: 10 }}>
            <p style={{ margin: 0 }}>{hub.localIdentity}</p>
            <div className="info-row">
              <span className="info-row__label">Property Flavor</span>
              <span className="info-row__value">{hub.propertyFlavor}</span>
            </div>
          </div>
        </ContentPanel>

        <ContentPanel title={hub.market.name}>
          <div style={{ display: "grid", gap: 10 }}>
            <p style={{ margin: 0, color: "#b7c3cf" }}>{hub.market.summary}</p>
            <div className="info-row">
              <span className="info-row__label">Imports</span>
              <span className="info-row__value">{hub.market.imports.join(", ")}</span>
            </div>
            <div className="info-row">
              <span className="info-row__label">Exports</span>
              <span className="info-row__value">{hub.market.exports.join(", ")}</span>
            </div>
            <ServiceLink service={hub.services.market} />
          </div>
        </ContentPanel>

        <ContentPanel title="People">
          <div id="people" style={{ display: "grid", gap: 10 }}>
            <p style={{ margin: 0, color: "#b7c3cf" }}>{hub.peopleIntro}</p>
            <PeopleList people={people} population={population} loading={peopleLoading} error={peopleError} />
          </div>
        </ContentPanel>

        <ContentPanel title="Academy">
          <div id="academy" style={{ display: "grid", gap: 10 }}>
            <strong>{hub.academy.name}</strong>
            <p style={{ margin: 0, color: "#b7c3cf" }}>{hub.academy.focus}</p>
            <div className="info-row"><span className="info-row__label">Theme</span><span className="info-row__value">{academyDetail.theme}</span></div>
            <div className="info-row"><span className="info-row__label">Entry</span><span className="info-row__value">{academyDetail.entryRequirements.join(" | ")}</span></div>
            <div className="info-row"><span className="info-row__label">Supports</span><span className="info-row__value">{academyDetail.progressionSupports.join(" | ")}</span></div>
            <ServiceLink service={hub.services.academy} />
            <div style={{ fontSize: 12, color: hub.academy.status === "open" ? "#8ec8a7" : "#d0ad74" }}>
              {hub.academy.status === "open" ? "Academy access is open here." : academyDetail.lockReason}
            </div>
            {hub.academy.unlockCourse ? (
              <div style={{ fontSize: 12, color: "#d0ad74" }}>Unlock path: {hub.academy.unlockCourse}</div>
            ) : null}
          </div>
        </ContentPanel>

        <ContentPanel title="Local Contracts">
          <div style={{ display: "grid", gap: 10 }}>
            {localContracts.map((contract) => (
              <Link key={contract.id} to={contract.route} className="inline-route-link" style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, background: "rgba(7, 13, 20, 0.55)", display: "grid", gap: 6, color: "inherit", textDecoration: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong>{contract.title}</strong>
                  <span style={{ color: contract.risk === "high" ? "#d98f8f" : contract.risk === "moderate" ? "#d0ad74" : "#8ec8a7", fontSize: 12 }}>{contract.risk} risk</span>
                </div>
                <div style={{ color: "#d8c278", fontSize: 12 }}>{contract.type}</div>
                <div style={{ color: "#b7c3cf", fontSize: 13 }}>{contract.summary}</div>
                <div style={{ color: "#9fb0bf", fontSize: 12 }}>Reward: {contract.reward}</div>
                <div style={{ color: "#9fb0bf", fontSize: 12 }}>Requirement: {contract.requirement}</div>
              </Link>
            ))}
          </div>
        </ContentPanel>

        <ContentPanel title="City Special">
          <div id="special" style={{ display: "grid", gap: 10 }}>
            <strong>{hub.special.name}</strong>
            <p style={{ margin: 0, color: "#b7c3cf" }}>{hub.special.summary}</p>
            <ServiceLink service={hub.services.citySpecial} />
          </div>
        </ContentPanel>

        <ContentPanel title="Local Services">
          <div style={{ display: "grid", gap: 10 }}>
            {[...openServiceCards, ...localServiceCards].map((service) => (
              <ServiceLink key={service.label} service={service} />
            ))}
          </div>
        </ContentPanel>
      </div>

      {hub.lockedContent.length ? (
        <ContentPanel title="Locked Content">
          <div style={{ display: "grid", gap: 10 }}>
            {hub.lockedContent.map((entry) => (
              <div
                key={entry.label}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: 12,
                  background: "rgba(7, 13, 20, 0.55)",
                  display: "grid",
                  gap: 6,
                }}
              >
                <strong>{entry.label}</strong>
                <div style={{ color: "#b7c3cf", fontSize: 13 }}>{entry.reason}</div>
                <div style={{ color: "#d0ad74", fontSize: 12 }}>Unlock path: {entry.unlockPath}</div>
              </div>
            ))}
          </div>
        </ContentPanel>
      ) : null}

      {city.id === "nexis" ? (
        <ContentPanel title="Nexis District Directory">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {districts.map((district) => (
              <div key={district.id} style={{ display: "grid", gap: 10 }}>
                <strong>{district.name}</strong>
                <div style={{ fontSize: 13, color: "#9fb0bf" }}>{district.summary}</div>
                {district.destinations.map((destination) => {
                  const service: CityService = {
                    label: destination.name,
                    route: destination.route,
                    status: destination.locked ? "locked" : "open",
                    summary: destination.description,
                    lockReason: destination.lockReason,
                  };
                  return <ServiceLink key={destination.id} service={service} />;
                })}
              </div>
            ))}
          </div>
        </ContentPanel>
      ) : null}
    </div>
  );
}
