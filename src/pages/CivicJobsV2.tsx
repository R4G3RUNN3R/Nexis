import { AppShell } from "../components/layout/AppShell";
import CivicJobsBoard from "../components/jobs/CivicJobsBoard";

export default function CivicJobsV2Page() {
  return (
    <AppShell
      title="Civic Jobs"
      hint="Civic employment offers one active city role at a time, with rank progress, daily pay, job points, and clear entry requirements."
    >
      <CivicJobsBoard />
    </AppShell>
  );
}
