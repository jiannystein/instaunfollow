# InstaUnfollow

**Find out who's not following you back on Instagram — and do something about it.**

Let's be honest. Over the years, you followed a bunch of accounts — that random food blog, your coworker's side hustle, some travel page from 2019 you forgot about. At some point you look at your following count and think, "wait, half these people don't even follow me back."

This tool helps you figure out who those people are, preview their profiles so you can make a decision, and batch-unfollow the ones you're done with. All from your browser. No installs, no extensions, no sketchy apps asking for your password.

## What It Does

InstaUnfollow is a **browser bookmarklet** that runs directly on instagram.com. It uses your existing login session to:

1. **Scan** your following and followers lists via Instagram's own API
2. **Compare** them to find who doesn't follow you back
3. **Preview** — hover any account to see their recent posts before deciding
4. **Bulk unfollow** — select the accounts you want to drop, hit the button, done

Everything runs in **your browser**. No server, no database, no data ever leaves your machine.

## How To Use

1. Open the [InstaUnfollow page](https://instaunfollow.github.io/) and **drag the bookmarklet** to your bookmarks bar
2. Head to [instagram.com](https://www.instagram.com/) and make sure you're logged in
3. Click the **"InstaUnfollow"** bookmark — a panel slides in on the right
4. Hit **"Start Scan"** and let it fetch your lists
5. Browse the results, hover to preview, select who to unfollow
6. Click **"Unfollow"** — sit back and let it work through the list

## Is This Safe?

Full transparency — this uses Instagram's private API, which technically goes against their Terms of Service (as does every third-party tool out there). That said, InstaUnfollow is built to be as careful as possible:

- **20–35 second delays** between each unfollow action
- **Safety pauses** of 3–8 minutes every 12–18 unfollows, getting longer as you go
- **No session cap** — it'll process your entire list, even if it takes an hour+
- **Pause & resume** any time you want
- **Zero credentials stored** — it just uses your existing browser session

## Privacy

This matters, so here's exactly what happens with your data:

- **Nothing is collected.** No analytics, no tracking, no telemetry.
- **No server exists.** This is a static HTML page on GitHub Pages.
- **Verify it yourself** — open DevTools → Network tab. The only requests go to `instagram.com`.
- **Fully open source** — every line of code is right here in this repo.

## How It Works Under The Hood

The bookmarklet injects a UI panel directly into instagram.com and calls the same API endpoints that Instagram's web app uses internally:

| Endpoint | What It Does |
|----------|-------------|
| `GET /api/v1/friendships/{id}/following/` | Fetches your following list (paginated) |
| `GET /api/v1/friendships/{id}/followers/` | Fetches your followers list (paginated) |
| `POST /api/v1/friendships/destroy/{id}/` | Unfollows a user |
| `GET /api/v1/feed/user/{id}/` | Loads recent posts for hover previews |

Since the bookmarklet runs **inside** instagram.com's origin, it has the same access as you browsing normally. No CORS workarounds, no token theft, no auth hacks.

### Why A Bookmarklet?

Instagram sets `Cross-Origin-Opener-Policy: same-origin` headers, which kills any cross-tab communication. A browser extension would work but needs installation and broad permissions. A bookmarklet is the lightest approach — one click, zero install, runs exactly where it needs to.

## Project Structure

```
instaunfollow/
├── index.html                  # The entire app — landing page + embedded bookmarklet
├── CLI+Playwright version/     # Legacy CLI tool (Playwright-based, for reference)
├── .gitignore
└── README.md
```

Yes, the whole thing is **one HTML file**. The bookmarklet JavaScript is embedded in the page and gets URL-encoded into the bookmark link when you drag it. No build step, no bundler, no framework.

## Legacy CLI Version

The original version of this tool used Node.js + Playwright to automate a real Chrome browser — navigate to profiles, scroll through modals, click buttons. It worked but required a local dev setup. It's preserved in `CLI+Playwright version/` if you're into that sort of thing.

## Disclaimer

Use at your own risk. This is an unofficial tool, not affiliated with Instagram or Meta. Aggressive unfollowing could result in temporary action blocks. The built-in rate limiting is designed to keep you safe, but nothing is guaranteed. Be smart about it.

---

*Built because sometimes you just need to clean up your feed.*
