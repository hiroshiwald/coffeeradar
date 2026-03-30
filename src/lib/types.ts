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
