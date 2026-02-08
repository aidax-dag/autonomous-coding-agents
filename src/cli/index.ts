#!/usr/bin/env node
/**
 * Multi-Agent CLI
 *
 * Entry point for the autonomous coding system CLI.
 * Pending migration from NATS-based architecture to OrchestratorRunner.
 *
 * See Task #24 (Modernize CLI entry point).
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createAutonomousCLI } from '@/cli/autonomous';
import dotenv from 'dotenv';

dotenv.config();

const program = new Command();

program
  .name('multi-agent')
  .description('Autonomous Coding Agents CLI')
  .version('1.0.0');

// Autonomous runner subcommand (stubbed, pending migration)
program.addCommand(createAutonomousCLI());

// Placeholder for old NATS-based commands
for (const cmd of ['submit', 'analyze', 'agents', 'jobs']) {
  program
    .command(cmd)
    .description(`${cmd} — pending migration to OrchestratorRunner`)
    .argument('[args...]')
    .action(() => {
      console.log(chalk.yellow(`The '${cmd}' command is being migrated.`));
      console.log(chalk.dim('Use the programmatic API:'));
      console.log(chalk.cyan("  import { createOrchestratorRunner } from '@/core/orchestrator';"));
      process.exit(1);
    });
}

program.parse(process.argv);
