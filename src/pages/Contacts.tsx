import { AppShell } from "../components/layout/AppShell";

export default function ContactsPage() {
  return (
    <AppShell title="Contacts" hint="Friend list and social contacts live here.">
      <div
        style={{
          minHeight: "420px",
          border: "1px solid #20262a",
          background: "#050607",
          padding: "16px",
          color: "#d5ddd2",
        }}
      >
        This page is a placeholder for now.
      </div>
    </AppShell>
  );
}
