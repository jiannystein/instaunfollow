import chalk from 'chalk';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import { Instagram } from './instagram';
import { findNonFollowers } from './compare';
import { RateLimiter } from './delays';
import { Config } from './types';

async function main() {
  console.log(chalk.bold.cyan('\n  InstaUnfollow - Find & Remove Non-Followers\n'));
  console.log(chalk.yellow('  WARNING: Use at your own risk. This violates Instagram ToS.'));
  console.log(chalk.yellow('  Your account could be suspended.\n'));

  // ─── Get username ───────────────────────────────────────
  const { username } = await inquirer.prompt([
    {
      type: 'input',
      name: 'username',
      message: 'Enter your Instagram username:',
      validate: (v: string) => v.trim().length > 0 || 'Username is required',
    },
  ]);

  const config: Config = {
    username: username.trim(),
    maxUnfollowsPerSession: 150,
    headless: false,
  };

  const ig = new Instagram(config);

  // Handle Ctrl+C gracefully
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n  Shutting down gracefully...'));
    await ig.close();
    process.exit(0);
  });

  try {
    // ─── Step 1: Initialize & Manual Login ────────────────
    console.log(chalk.bold('\n  Step 1: Opening browser for login...\n'));
    await ig.init();

    const loggedIn = await ig.waitForManualLogin();
    if (!loggedIn) {
      console.log(chalk.red('\n  Login not detected. Exiting.'));
      await ig.close();
      process.exit(1);
    }

    // ─── Step 2: Ask what to do ───────────────────────────
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Scan & find who doesn\'t follow me back', value: 'scan' },
          { name: 'Load previous scan results', value: 'load' },
        ],
      },
    ]);

    let notFollowingBack: string[] = [];

    if (action === 'scan') {
      // ─── Step 3: Scrape following ─────────────────────────
      console.log(chalk.bold('\n  Step 2: Scraping your following list...\n'));
      const following = await ig.scrapeFollowingList(config.username);

      // ─── Step 4: Scrape followers ─────────────────────────
      console.log(chalk.bold('\n  Step 3: Scraping your followers list...\n'));
      const followers = await ig.scrapeFollowersList(config.username);

      // ─── Step 5: Compare ──────────────────────────────────
      console.log(chalk.bold('\n  Step 4: Comparing lists...\n'));
      const result = findNonFollowers(following, followers);

      console.log(chalk.white(`  Following: ${result.totalFollowing}`));
      console.log(chalk.white(`  Followers: ${result.totalFollowers}`));
      console.log(chalk.white(`  Mutual:    ${result.mutualFollowers.length}`));
      console.log(chalk.red.bold(`  Not following back: ${result.notFollowingBack.length}\n`));

      notFollowingBack = result.notFollowingBack;
    } else {
      // Load from previous results
      const resultsDir = path.join(process.cwd(), 'data', 'results');
      if (!fs.existsSync(resultsDir)) {
        console.log(chalk.red('  No previous results found.'));
        await ig.close();
        process.exit(1);
      }

      const files = fs.readdirSync(resultsDir).filter((f) => f.endsWith('.json')).sort().reverse();
      if (files.length === 0) {
        console.log(chalk.red('  No previous results found.'));
        await ig.close();
        process.exit(1);
      }

      const { selectedFile } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedFile',
          message: 'Select a results file:',
          choices: files,
        },
      ]);

      const data = JSON.parse(fs.readFileSync(path.join(resultsDir, selectedFile), 'utf-8'));
      notFollowingBack = data.notFollowingBack;
      console.log(chalk.white(`  Loaded ${notFollowingBack.length} non-followers from ${selectedFile}\n`));
    }

    if (notFollowingBack.length === 0) {
      console.log(chalk.green('  Everyone follows you back! Nothing to do.'));
      await ig.close();
      return;
    }

    // ─── Step 6: Select who to unfollow ───────────────────
    const { selectedUsers } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedUsers',
        message: `Select users to unfollow (${notFollowingBack.length} don't follow you back):`,
        choices: notFollowingBack.map((u) => ({
          name: `@${u}`,
          value: u,
        })),
        pageSize: 20,
      },
    ]);

    if (selectedUsers.length === 0) {
      console.log(chalk.yellow('  No users selected. Exiting.'));
      await ig.close();
      return;
    }

    // ─── Step 7: Confirm ──────────────────────────────────
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to unfollow ${selectedUsers.length} users?`,
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow('  Cancelled. Exiting.'));
      await ig.close();
      return;
    }

    // ─── Step 8: Unfollow ─────────────────────────────────
    console.log(chalk.bold(`\n  Step 5: Unfollowing ${selectedUsers.length} users...\n`));

    const rateLimiter = new RateLimiter(config.maxUnfollowsPerSession);

    const result = await ig.unfollowUsers(selectedUsers, rateLimiter, (progress) => {
      const stats = rateLimiter.getStats();
      console.log(
        chalk.gray(
          `  Progress: ${progress.completed}/${progress.total} | ` +
          `Failed: ${progress.failed.length} | ` +
          `Session: ${stats.actions} actions in ${stats.elapsed}`
        )
      );
    });

    // ─── Done ─────────────────────────────────────────────
    console.log(chalk.bold.green('\n  Done!\n'));
    console.log(chalk.white(`  Unfollowed: ${result.unfollowed.length}`));
    console.log(chalk.white(`  Failed:     ${result.failed.length}`));

    if (result.failed.length > 0) {
      console.log(chalk.gray(`  Failed users: ${result.failed.join(', ')}`));
    }

    // Save unfollow results
    const resultsDir = path.join(process.cwd(), 'data', 'results');
    fs.mkdirSync(resultsDir, { recursive: true });
    const resultFile = path.join(resultsDir, `unfollow-log-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
    console.log(chalk.gray(`  Log saved to ${resultFile}\n`));

    await ig.close();
  } catch (err) {
    console.error(chalk.red(`\n  Fatal error: ${(err as Error).message}`));
    await ig.close();
    process.exit(1);
  }
}

main();
