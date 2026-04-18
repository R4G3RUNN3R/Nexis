import { PlaceholderPage } from "../components/layout/PlaceholderPage";

export default function BankPage() {
  return (
    <PlaceholderPage
      title="Bank"
      description="The Nexis banking hall is reserved in the city structure, but long-term deposits, reserves, and institution upgrades are still being wired."
      bullets={[
        "Personal deposits and withdrawals will live here.",
        "Long-term reserves and interest tiers are planned here.",
        "Guild and consortium treasury hooks will eventually flow through the same financial layer.",
      ]}
    />
  );
}
