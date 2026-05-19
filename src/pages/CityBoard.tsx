import { AppShell } from "../components/layout/AppShell";
import CityBoardSections from "../components/city/CityBoardSections";

export default function CityBoardPage() {
  return (
    <AppShell
      title="City Board"
      hint="A local paper-style board for civic appointments, opportunities, bounties, notices, and classifieds."
    >
      <CityBoardSections />
    </AppShell>
  );
}
