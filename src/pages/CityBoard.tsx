import { AppShell } from "../components/layout/AppShell";
import CityBoardSections from "../components/city/CityBoardSections";

export default function CityBoardPage() {
  return (
    <AppShell
      title="City Board"
      hint="Public postings, civic work, notices, bounties, and property leads from the city board."
    >
      <CityBoardSections />
    </AppShell>
  );
}
