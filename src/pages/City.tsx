import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import CityDistrictHub from "../components/city/CityDistrictHub";
import { worldCities } from "../data/worldMapData";
import { cielCityCopy, cielPageCopy } from "../data/cielPageCopy";
import { resolveTravelState } from "../lib/travelState";
import { usePlayer } from "../state/PlayerContext";

export default function CityPage() {
  const { player } = usePlayer();
  const travelState = resolveTravelState(player.internalId);
  const currentCity = worldCities.find((city) => city.id === travelState.currentCityId) ?? worldCities[0];
  const pageCopy = cielPageCopy.city;
  const cityCopy = cielCityCopy[currentCity.id] ?? pageCopy;

  return (
    <AppShell title={currentCity.name} hint={cityCopy.flavor}>
      <div className="page-intro-grid">
        <ContentPanel title="City Flavor">
          <p className="page-intro__lead">{cityCopy.flavor}</p>
          <p className="page-intro__body">{cityCopy.alt ?? pageCopy.alt}</p>
        </ContentPanel>
        <ContentPanel title="CIEL">
          <p className="page-intro__body">{cityCopy.ciel}</p>
        </ContentPanel>
      </div>

      <CityDistrictHub city={currentCity} />
    </AppShell>
  );
}
