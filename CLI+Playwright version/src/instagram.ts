import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { SELECTORS, findElement } from './selectors';
import { randomDelay, RateLimiter } from './delays';
import { Config, UnfollowProgress } from './types';

const SESSION_DIR = path.join(process.cwd(), 'data', 'session');
const SESSION_FILE = path.join(SESSION_DIR, 'cookies.json');

export class Instagram {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async init(): Promise<Page> {
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    // Load saved session if available
    const storageState = fs.existsSync(SESSION_FILE) ? SESSION_FILE : undefined;

    this.context = await this.browser.newContext({
      storageState,
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'en-US',
    });

    this.page = await this.context.newPage();
    return this.page;
  }

  async saveSession(): Promise<void> {
    if (!this.context) return;
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    const storage = await this.context.storageState();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(storage, null, 2));
    console.log(chalk.gray('  Session saved.'));
  }

  async close(): Promise<void> {
    await this.saveSession();
    await this.browser?.close();
  }

  // ─── Login (Manual) ────────────────────────────────────

  async waitForManualLogin(): Promise<boolean> {
    const page = this.page!;
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await randomDelay(2000, 3000);

    // Check if already logged in from saved session
    if (await this.isLoggedIn()) {
      console.log(chalk.green('  Already logged in (session restored).'));
      return true;
    }

    // User needs to login manually
    console.log(chalk.cyan('  ┌─────────────────────────────────────────────┐'));
    console.log(chalk.cyan('  │  A browser window has opened.               │'));
    console.log(chalk.cyan('  │  Please log in to Instagram manually.       │'));
    console.log(chalk.cyan('  │  Handle 2FA, CAPTCHAs, etc. as needed.     │'));
    console.log(chalk.cyan('  │                                             │'));
    console.log(chalk.cyan('  │  Waiting for you to complete login...       │'));
    console.log(chalk.cyan('  └─────────────────────────────────────────────┘'));
    console.log('');

    // Poll for login completion (check every 3 seconds, timeout 5 minutes)
    const maxWait = 5 * 60 * 1000;
    const pollInterval = 3000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      if (await this.isLoggedIn()) {
        console.log(chalk.green('  Login detected! Saving session...\n'));
        await this.saveSession();
        return true;
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }

    console.log(chalk.red('  Login timed out after 5 minutes.'));
    return false;
  }

  private async isLoggedIn(): Promise<boolean> {
    const page = this.page!;
    try {
      // Check for elements that only appear when logged in
      const homeIcon = page.locator('svg[aria-label="Home"]').first();
      const searchIcon = page.locator('svg[aria-label="Search"]').first();
      const isHome = await homeIcon.isVisible({ timeout: 2000 }).catch(() => false);
      const isSearch = await searchIcon.isVisible({ timeout: 1000 }).catch(() => false);
      return isHome || isSearch;
    } catch {
      return false;
    }
  }

  // ─── Scrape Lists ───────────────────────────────────────

  async scrapeFollowingList(username: string): Promise<string[]> {
    return this.scrapeUserList(username, 'following');
  }

  async scrapeFollowersList(username: string): Promise<string[]> {
    return this.scrapeUserList(username, 'followers');
  }

  private async getProfileCounts(page: Page): Promise<{ followers: number; following: number }> {
    // Read the actual counts displayed on the profile page
    const counts = await page.evaluate(() => {
      const items = document.querySelectorAll('ul li');
      let followers = 0;
      let following = 0;
      items.forEach((li) => {
        const text = li.textContent || '';
        // Match patterns like "420 followers" or "380 following"
        const followerMatch = text.match(/([\d,]+)\s*followers/i);
        const followingMatch = text.match(/([\d,]+)\s*following/i);
        if (followerMatch) followers = parseInt(followerMatch[1].replace(/,/g, ''), 10);
        if (followingMatch) following = parseInt(followingMatch[1].replace(/,/g, ''), 10);
      });

      // Fallback: try meta or header sections if ul li didn't work
      if (followers === 0 && following === 0) {
        const allText = document.body.innerText;
        const fMatch = allText.match(/([\d,]+)\s*followers/i);
        const gMatch = allText.match(/([\d,]+)\s*following/i);
        if (fMatch) followers = parseInt(fMatch[1].replace(/,/g, ''), 10);
        if (gMatch) following = parseInt(gMatch[1].replace(/,/g, ''), 10);
      }

      return { followers, following };
    });
    return counts;
  }

  private async scrapeUserList(username: string, type: 'following' | 'followers'): Promise<string[]> {
    const page = this.page!;

    // Navigate to profile
    console.log(chalk.blue(`  Navigating to ${username}'s profile...`));
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await randomDelay(3000, 5000);

    // Get expected count from profile page
    const profileCounts = await this.getProfileCounts(page);
    const expectedCount = type === 'following' ? profileCounts.following : profileCounts.followers;
    console.log(chalk.white(`  Expected ${type} count: ${expectedCount}`));

    // Click following or followers link
    const linkSelectors = type === 'following'
      ? SELECTORS.profile.followingLink
      : SELECTORS.profile.followersLink;

    const link = await findElement(page, linkSelectors);
    if (!link) {
      console.log(chalk.red(`  Could not find ${type} link.`));
      return [];
    }
    await link.click();
    await randomDelay(2000, 3000);

    // Wait for modal
    const modal = await findElement(page, SELECTORS.modal.dialog);
    if (!modal) {
      console.log(chalk.red('  Could not find list modal.'));
      return [];
    }

    // Scroll and collect usernames until we hit the expected count
    console.log(chalk.blue(`  Scraping ${type} list (scrolling to collect all ${expectedCount})...`));
    const usernames = await this.scrollAndCollectUsernames(page, expectedCount);

    console.log(chalk.green(`  Collected ${usernames.length}/${expectedCount} ${type}.`));

    // Close modal by pressing Escape
    await page.keyboard.press('Escape');
    await randomDelay(1000, 2000);

    return usernames;
  }

  private async scrollAndCollectUsernames(page: Page, expectedCount: number): Promise<string[]> {
    const collected = new Set<string>();
    let noNewCount = 0;
    const maxNoNew = Math.max(15, Math.ceil(expectedCount / 10));

    // First, find the scrollable container inside the modal
    // We need to identify it once so we can scroll it reliably
    await randomDelay(1500, 2500);

    while (noNewCount < maxNoNew) {
      if (expectedCount > 0 && collected.size >= expectedCount) {
        break;
      }

      // Collect visible usernames from the modal
      const usernames = await page.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"]');
        if (!dialog) return [];

        const links = dialog.querySelectorAll('a[role="link"]');
        const names: string[] = [];
        links.forEach((link) => {
          const href = link.getAttribute('href');
          if (href && href.startsWith('/') && href !== '/') {
            const username = href.replace(/\//g, '');
            if (username && !['explore', 'reels', 'stories', 'direct'].includes(username)) {
              names.push(username);
            }
          }
        });
        return names;
      });

      const prevSize = collected.size;
      usernames.forEach((u) => collected.add(u));

      if (collected.size === prevSize) {
        noNewCount++;
      } else {
        noNewCount = 0;
      }

      const pct = expectedCount > 0
        ? ` (${Math.round((collected.size / expectedCount) * 100)}%)`
        : '';
      process.stdout.write(chalk.gray(`\r  Collected ${collected.size}/${expectedCount} usernames${pct}   `));

      // Scroll: find the deepest scrollable element inside the dialog and
      // scroll it to the very bottom. Instagram lazy-loads new users only
      // when the scrollable container reaches the end.
      await page.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"]');
        if (!dialog) return;

        // Walk all descendants to find the one that actually scrolls
        // (has scrollHeight > clientHeight)
        let scrollTarget: Element | null = null;
        const candidates = dialog.querySelectorAll('div');
        for (const div of Array.from(candidates)) {
          if (div.scrollHeight > div.clientHeight + 10) {
            // Pick the deepest / most specific scrollable container
            if (!scrollTarget || div.contains(scrollTarget) === false) {
              scrollTarget = div;
            }
          }
        }

        if (scrollTarget) {
          scrollTarget.scrollTop = scrollTarget.scrollHeight;
        }
      });

      // Wait for Instagram to load the next batch of users
      await randomDelay(2000, 3500);
    }

    console.log(''); // New line after progress
    return Array.from(collected);
  }

  // ─── Unfollow ───────────────────────────────────────────

  async unfollowUsers(
    usernames: string[],
    rateLimiter: RateLimiter,
    onProgress?: (progress: UnfollowProgress) => void
  ): Promise<UnfollowProgress> {
    const page = this.page!;
    const progress: UnfollowProgress = {
      total: usernames.length,
      completed: 0,
      failed: [],
      unfollowed: [],
      startedAt: new Date().toISOString(),
    };

    for (const username of usernames) {
      if (!rateLimiter.canContinue()) {
        console.log(chalk.red('\n  Rate limit reached. Stopping unfollows for this session.'));
        break;
      }

      try {
        console.log(
          chalk.blue(`  [${progress.completed + 1}/${progress.total}] Unfollowing @${username}...`)
        );

        // Navigate to user profile
        await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await randomDelay(2000, 4000);

        // Simulate reading the profile briefly
        await randomDelay(800, 2000);

        // Click "Following" button
        const followingBtn = await findElement(page, SELECTORS.unfollow.followingButton);
        if (!followingBtn) {
          console.log(chalk.yellow(`  Skipping @${username} - no "Following" button found.`));
          progress.failed.push(username);
          continue;
        }
        await followingBtn.click();
        await randomDelay(1000, 2000);

        // Click "Unfollow" in confirmation dialog
        const confirmBtn = await findElement(page, SELECTORS.unfollow.unfollowConfirm);
        if (!confirmBtn) {
          console.log(chalk.yellow(`  Skipping @${username} - no confirm dialog found.`));
          progress.failed.push(username);
          continue;
        }
        await confirmBtn.click();
        await randomDelay(1000, 2000);

        progress.unfollowed.push(username);
        progress.completed++;
        console.log(chalk.green(`  Unfollowed @${username}`));

        // Rate limit aware waiting
        await rateLimiter.recordActionAndWait();

        onProgress?.(progress);
      } catch (err) {
        console.log(chalk.red(`  Error unfollowing @${username}: ${(err as Error).message}`));
        progress.failed.push(username);

        // Extra delay after error
        await randomDelay(5000, 10000);
      }
    }

    return progress;
  }
}
