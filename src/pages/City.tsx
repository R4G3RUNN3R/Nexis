import { AppShell } from "../components/layout/AppShell";
import CityDistrictHub from "../components/city/CityDistrictHub";
import { worldCities } from "../data/worldMapData";
import { resolveTravelState } from "../lib/travelState";
import { usePlayer } from "../state/PlayerContext";

export default function CityPage() {
  const { player } = usePlayer();
  const travelState = resolveTravelState(player.internalId);
  const currentCity = worldCities.find((city) => city.id === travelState.currentCityId) ?? worldCities[0];

  return (
    <AppShell
      title={currentCity.name}
      hint={`${currentCity.name} now reflects your actual travel destination instead of stubbornly pretending every road leads back to Nexis.`}
    >
      <CityDistrictHub city={currentCity} />
    </AppShell>
  );
}
