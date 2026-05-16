import { PlaceholderPage } from "../components/layout/PlaceholderPage";

export default function BankPage() {
  return (
    <PlaceholderPage
      title="Bank"
      description="The Nexis banking hall is reserved in the city structure, but deposits, reserves, and institution upgrades are not open yet."
      bullets={[
        "Personal deposits and withdrawals are coming later.",
        "Long-term reserves and interest tiers are planned for this hall.",
        "Guild and consortium treasury hooks will use a separate verified finance layer before this opens.",
      ]}
    />
  );
}
