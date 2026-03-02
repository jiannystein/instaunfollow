import * as fs from 'fs';
import * as path from 'path';
import { ComparisonResult } from './types';

const RESULTS_DIR = path.join(process.cwd(), 'data', 'results');

export function findNonFollowers(following: string[], followers: string[]): ComparisonResult {
  const followersSet = new Set(followers.map((f) => f.toLowerCase()));
  const followingSet = new Set(following.map((f) => f.toLowerCase()));

  const notFollowingBack = following.filter(
    (user) => !followersSet.has(user.toLowerCase())
  );

  const mutualFollowers = following.filter(
    (user) => followersSet.has(user.toLowerCase())
  );

  const result: ComparisonResult = {
    notFollowingBack,
    mutualFollowers,
    totalFollowing: following.length,
    totalFollowers: followers.length,
    comparedAt: new Date().toISOString(),
  };

  // Save results to file
  saveResults(result);

  return result;
}

function saveResults(result: ComparisonResult): void {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const date = new Date().toISOString().split('T')[0];
  const filename = `non-followers-${date}.json`;
  const filepath = path.join(RESULTS_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
  console.log(`  Results saved to ${filepath}`);
}
