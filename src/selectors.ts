// Instagram DOM selectors with fallbacks
// Uses text-based and aria selectors where possible (most resilient to UI changes)

export const SELECTORS = {
  login: {
    usernameInput: [
      'input[name="username"]',
      'input[aria-label="Phone number, username, or email"]',
    ],
    passwordInput: [
      'input[name="password"]',
      'input[aria-label="Password"]',
    ],
    loginButton: [
      'button[type="submit"]',
      'button:has-text("Log in")',
    ],
  },

  dialogs: {
    saveLoginNotNow: [
      'button:has-text("Not Now")',
      'div[role="button"]:has-text("Not Now")',
    ],
    notificationsNotNow: [
      'button:has-text("Not Now")',
      'div[role="button"]:has-text("Not Now")',
    ],
  },

  profile: {
    followingLink: [
      'a[href*="/following/"]',
      'a[href*="/following"]',
    ],
    followersLink: [
      'a[href*="/followers/"]',
      'a[href*="/followers"]',
    ],
  },

  modal: {
    dialog: [
      'div[role="dialog"]',
    ],
    scrollableList: [
      'div[role="dialog"] div[style*="overflow"]',
      'div[role="dialog"] ul',
      'div[role="dialog"] div[class] > div > div',
    ],
    userLink: [
      'div[role="dialog"] a[role="link"]',
      'div[role="dialog"] a[href^="/"]',
    ],
    username: [
      'div[role="dialog"] a[role="link"] span',
      'div[role="dialog"] a span > span',
    ],
  },

  unfollow: {
    followingButton: [
      'button:has-text("Following")',
      'div[role="button"]:has-text("Following")',
    ],
    unfollowConfirm: [
      'button:has-text("Unfollow")',
      'div[role="button"]:has-text("Unfollow")',
    ],
  },
};

// Try multiple selectors and return the first one that matches
import { Page, Locator } from 'playwright';

export async function findElement(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const selector of selectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        return el;
      }
    } catch {
      continue;
    }
  }
  return null;
}
