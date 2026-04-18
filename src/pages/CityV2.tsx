import { AppShell } from "../components/layout/AppShell";
import CityDistrictHub from "../components/city/CityDistrictHub";
import { worldCities } from "../data/worldMapData";

export default function CityV2Page() {
  return (
    <AppShell
      title="City"
      hint="Nexis City rebuilt as a district hub: denser, clearer, and less embarrassingly blank. Still grim, just more useful."
    >
      <CityDistrictHub city={worldCities[0]} />
    </AppShell>
  );
}
