export type NewsStory = {
  title: string;
  date: string;
  summary: string;
};

export const newsStories: NewsStory[] = [
  {
    title: "City board expansion underway",
    date: "16 May 2026",
    summary:
      "Public notices, contracts, properties, and faction bulletins are being consolidated into a single browsable board so Nexis feels like a live city instead of a collection of disconnected menus.",
  },
  {
    title: "Education reforms approved",
    date: "15 May 2026",
    summary:
      "General Studies, Street Survival, Applied Knowledge, and academy specializations now present clearer hard-gated progression. Locked systems explain why they are locked and what path unlocks them.",
  },
  {
    title: "Travel discoveries being mapped",
    date: "14 May 2026",
    summary:
      "World Geography is now positioned as the first meaningful travel gate. Future journeys will support passive discoveries, ruin finds, and rare item events after arrival.",
  },
  {
    title: "Consortium charter drafted",
    date: "13 May 2026",
    summary:
      "Civic Fundamentals is planned as the formal requirement for founding a consortium, gaining permits, and taking on city contracts under the Nexis civic charter.",
  },
];
