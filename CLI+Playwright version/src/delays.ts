import chalk from 'chalk';

// Random integer between min and max (inclusive)
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Sleep for a random duration between min and max milliseconds
export async function randomDelay(minMs: number, maxMs: number, label?: string): Promise<void> {
  const ms = randomInt(minMs, maxMs);
  if (label) {
    console.log(chalk.gray(`  ${label} (${(ms / 1000).toFixed(1)}s)...`));
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Type text with human-like delays between keystrokes
export async function humanType(
  callback: (char: string) => Promise<void>,
  text: string
): Promise<void> {
  for (const char of text) {
    await callback(char);
    await randomDelay(50, 200);
  }
}

/**
 * Rate limiter that auto-pauses before hitting Instagram limits.
 *
 * Strategy:
 * - Every 25-35 actions: pause 2-5 minutes
 * - After 90 actions: pause 3-7 minutes
 * - After 120 actions: pause 5-10 minutes
 * - After 150 actions: stop session
 * - All timings randomized
 */
export class RateLimiter {
  private actionCount = 0;
  private sessionStart = Date.now();
  private nextPauseAt: number;
  private readonly maxPerSession: number;

  constructor(maxPerSession = 150) {
    this.maxPerSession = maxPerSession;
    this.nextPauseAt = randomInt(25, 35);
  }

  get count(): number {
    return this.actionCount;
  }

  canContinue(): boolean {
    return this.actionCount < this.maxPerSession;
  }

  async recordActionAndWait(): Promise<void> {
    this.actionCount++;

    if (!this.canContinue()) {
      console.log(chalk.red(`\n  Session limit reached (${this.maxPerSession} actions). Stopping.`));
      return;
    }

    // Check if we need to take a longer pause
    if (this.actionCount >= this.nextPauseAt) {
      await this.takePause();
      // Set next pause point
      this.nextPauseAt = this.actionCount + randomInt(25, 35);
    }

    // Normal delay between actions (3-8 seconds)
    await randomDelay(3000, 8000, 'Waiting before next action');
  }

  private async takePause(): Promise<void> {
    let pauseMin: number;
    let pauseMax: number;

    if (this.actionCount > 120) {
      pauseMin = 5 * 60 * 1000;  // 5 min
      pauseMax = 10 * 60 * 1000; // 10 min
    } else if (this.actionCount > 90) {
      pauseMin = 3 * 60 * 1000;  // 3 min
      pauseMax = 7 * 60 * 1000;  // 7 min
    } else {
      pauseMin = 2 * 60 * 1000;  // 2 min
      pauseMax = 5 * 60 * 1000;  // 5 min
    }

    const pauseMs = randomInt(pauseMin, pauseMax);
    const pauseSec = Math.round(pauseMs / 1000);
    const pauseMinutes = (pauseSec / 60).toFixed(1);

    console.log(chalk.yellow(
      `\n  Rate limit protection: pausing for ${pauseMinutes} min (${this.actionCount} actions so far)...`
    ));

    // Countdown display
    const intervalSec = 30;
    let remaining = pauseSec;
    while (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(intervalSec, remaining) * 1000));
      remaining -= intervalSec;
      if (remaining > 0) {
        console.log(chalk.gray(`  ...resuming in ${Math.round(remaining / 60 * 10) / 10} min`));
      }
    }

    console.log(chalk.green('  Resuming...\n'));
  }

  getStats(): { actions: number; elapsed: string; remaining: number } {
    const elapsedMs = Date.now() - this.sessionStart;
    const elapsedMin = Math.round(elapsedMs / 60000);
    return {
      actions: this.actionCount,
      elapsed: `${elapsedMin} min`,
      remaining: this.maxPerSession - this.actionCount,
    };
  }
}
