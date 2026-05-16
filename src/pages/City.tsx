import { AppShell } from "../components/layout/AppShell";
import CityDistrictHub from "../components/city/CityDistrictHub";
import { worldCities } from "../data/worldMapData";
import { readTravelStateFromPlayer } from "../lib/travelState";
import { usePlayer } from "../state/PlayerContext";

export default function CityPage() {
  const { player } = usePlayer();
  const travelState = readTravelStateFromPlayer(player);
  const currentCity = worldCities.find((city) => city.id === travelState.currentCityId) ?? worldCities[0];

  return (
    <AppShell
      title={currentCity.name}
      hint={`District services, local routes, and civic access for your current city: ${currentCity.name}.`}
    >
      <CityDistrictHub city={currentCity} />
    </AppShell>
  );
}
