import { AppShell } from "../components/layout/AppShell";
import CityBoardSections from "../components/city/CityBoardSections";

export default function CityBoardV2Page() {
  return (
    <AppShell
      title="City Board"
      hint="Nexis public board rebuilt as the city newspaper equivalent: jobs, notices, opportunities, bounties, and property leads. Much better than an empty page pretending to be mysterious."
    >
      <CityBoardSections />
    </AppShell>
  );
}
