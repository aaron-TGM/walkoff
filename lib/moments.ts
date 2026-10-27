export type MomentStatus = "now" | "next" | "soon";

export interface MomentCategory {
  id: string;
  name: string;
  status: MomentStatus;
  description: string;
  examples: string[];
}

export const MOMENT_STATUS_LABEL: Record<MomentStatus, string> = {
  now: "Now",
  next: "Next",
  soon: "Soon",
};

export const MOMENT_CATEGORIES: MomentCategory[] = [
  {
    id: "sports",
    name: "Sports",
    status: "now",
    description:
      "Walk-offs, buzzer beaters, derby wins, comebacks, titles and big signings in every league we watch, plus hometown moments when someone from a town near your customers wins.",
    examples: ["Walk-off win", "Derby win", "Hometown win"],
  },
  {
    id: "weather",
    name: "Weather",
    status: "next",
    description:
      "First freeze, heat waves, rainy weekends and first snow, local to your customers' postal codes.",
    examples: ["First freeze", "Heat wave", "First snow"],
  },
  {
    id: "events",
    name: "Local events",
    status: "soon",
    description:
      "Tour stops, festivals, marathons and home openers near your customers.",
    examples: ["Tour stop", "Festival", "Marathon"],
  },
  {
    id: "culture",
    name: "Holidays & culture",
    status: "soon",
    description:
      "Holidays in every market, Diwali, Lunar New Year, back to school and paydays.",
    examples: ["Diwali", "Lunar New Year", "Payday"],
  },
  {
    id: "trends",
    name: "Trends",
    status: "soon",
    description:
      "Whatever your customers are suddenly searching for and reading about.",
    examples: ["Search spike", "Viral moment", "Award show"],
  },
];
