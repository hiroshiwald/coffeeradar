export interface FeedSource {
  name: string;
  url: string;
  website: string;
  enabled?: boolean;
}

export interface CoffeeEntry {
  id: string;
  roaster: string;
  coffee: string;
  type: "Single Origin" | "Blend" | "Unknown";
  process: string;
  tastingNotes: string[];
  price: string;
  date: string;
  link: string;
  imageUrl: string;
  isMerch: boolean;
}

export interface SiteUser {
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export interface ApiResponse {
  coffees: CoffeeEntry[];
  meta: {
    healthy: number;
    failed: number;
    total: number;
    lastRefresh: string;
    isFallback: boolean;
  };
}

export type FilterMode = "all" | "healthy" | "failed" | "unknown";

export interface SiteUserInfo {
  username: string;
  createdAt: string;
}

export interface FeedSuggestion {
  sourceUrl: string;
  suggestedFeedUrl: string | null;
  suggestedWebsite: string | null;
  preflightOk: boolean;
  reason: string | null;
  checkedAt: string;
}
