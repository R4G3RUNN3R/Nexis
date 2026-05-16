import { AppShell } from "../components/layout/AppShell";
import PropertyOfficeBoard from "../components/city/PropertyOfficeBoard";

export default function PropertyOfficePage() {
  return (
    <AppShell
      title="Property Office"
      hint="Organization plots use level-gated purchase, no upkeep while unbuilt, prepaid construction, and NPC sellback at a loss."
    >
      <PropertyOfficeBoard />
    </AppShell>
  );
}
