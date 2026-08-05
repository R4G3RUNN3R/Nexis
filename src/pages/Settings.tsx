import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";

export default function SettingsPage() {
  return (
    <AppShell title="Settings" hint="Account and display preferences.">
      <ContentPanel title="Display">
        <div className="info-row">
          <span className="info-row__label">News Ticker</span>
          <span className="info-row__value">Toggle from your avatar menu (top right).</span>
        </div>
      </ContentPanel>

      <ContentPanel title="Account">
        <div className="info-row">
          <span className="info-row__label">More settings</span>
          <span className="info-row__value">Notification preferences, privacy controls, and account management are planned for a future update.</span>
        </div>
      </ContentPanel>
    </AppShell>
  );
}
