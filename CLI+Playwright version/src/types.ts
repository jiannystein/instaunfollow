export interface Config {
  username: string;
  maxUnfollowsPerSession: number;
  headless: boolean;
}

export interface ScrapeResult {
  username: string;
  following: string[];
  followers: string[];
  scrapedAt: string;
}

export interface ComparisonResult {
  notFollowingBack: string[];
  mutualFollowers: string[];
  totalFollowing: number;
  totalFollowers: number;
  comparedAt: string;
}

export interface UnfollowProgress {
  total: number;
  completed: number;
  failed: string[];
  unfollowed: string[];
  startedAt: string;
}
