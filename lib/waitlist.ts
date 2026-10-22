export const ROLES = ["Brand", "Agency", "Local business", "Other"] as const;

export const PLATFORMS = [
  "Klaviyo",
  "Shopify Email",
  "Omnisend",
  "Mailchimp",
  "Attentive",
  "Postscript",
  "Other / not sure",
] as const;

export interface WaitlistSubmission {
  company: string;
  email: string;
  website: string;
  role: (typeof ROLES)[number];
  platform: (typeof PLATFORMS)[number];
  leagues: string[];
  teams: string;
}
