import { AppShell } from "../components/layout/AppShell";
import CityDistrictHub from "../components/city/CityDistrictHub";

export default function CityPage() {
  return (
    <AppShell
      title="City"
      hint="Nexis City rebuilt as a district hub with denser structure, clearer grouping, and direct access to core civic, commercial, and faction destinations."
    >
      <CityDistrictHub />
    </AppShell>
  );
}
