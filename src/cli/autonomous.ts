/**
 * Autonomous Runner CLI
 *
 * Stub — will be reimplemented on top of OrchestratorRunner.
 * See Task #24 (Modernize CLI entry point).
 */

import { Command } from 'commander';
import chalk from 'chalk';

export function createAutonomousCLI(): Command {
  const program = new Command();

  program
    .name('runner')
    .description('Autonomous Runner CLI (pending migration to OrchestratorRunner)')
    .version('1.0.0');

  for (const cmd of ['create', 'run', 'status', 'stop', 'pause', 'resume']) {
    program
      .command(cmd)
      .description(`${cmd} — not yet migrated to OrchestratorRunner`)
      .argument('[args...]')
      .action(() => {
        console.log(
          chalk.yellow(`The '${cmd}' command is being migrated to OrchestratorRunner.`),
        );
        console.log(chalk.dim('Use the programmatic API in the meantime:'));
        console.log(chalk.cyan("  import { createOrchestratorRunner } from '@/core/orchestrator';"));
        process.exit(1);
      });
  }

  return program;
}
