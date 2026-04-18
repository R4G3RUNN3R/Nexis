export type CielEntry = {
  page: string;
  questions: {
    q: string;
    a: string;
  }[];
};

export const cielData: CielEntry[] = [
  {
    page: "home",
    questions: [
      {
        q: "What is Nexis?",
        a: "Nexis is a persistent world where your actions define your progression.",
      },
      {
        q: "What should I do first?",
        a: "Begin with Education. It unlocks core systems.",
      },
    ],
  },
  {
    page: "education",
    questions: [
      {
        q: "Why is Education important?",
        a: "Education unlocks Jobs, Skills, and progression paths.",
      },
      {
        q: "Can I take multiple courses?",
        a: "No. Only one course can be active at a time.",
      },
    ],
  },
  {
    page: "jobs",
    questions: [
      {
        q: "How do I unlock jobs?",
        a: "Jobs unlock through Education progression.",
      },
      {
        q: "Can I switch jobs?",
        a: "Yes, but restrictions may apply later.",
      },
    ],
  },
];
