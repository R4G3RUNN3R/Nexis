import { AppShell } from "../components/layout/AppShell";
import CivicJobsBoard from "../components/jobs/CivicJobsBoard";

export default function CivicJobsV2Page() {
  return (
    <AppShell
      title="Civic Jobs"
      hint="Civic employment now has real joining, shift, and promotion logic instead of decorative paperwork."
    >
      <CivicJobsBoard />
    </AppShell>
  );
}
