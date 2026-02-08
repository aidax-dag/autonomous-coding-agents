#!/usr/bin/env node
/**
 * Multi-Agent CLI
 *
 * Entry point for the autonomous coding system CLI.
 * Commands are backed by OrchestratorRunner.
 */

import { Command } from 'commander';
import { createAutonomousCLI } from '@/cli/autonomous';
import dotenv from 'dotenv';

dotenv.config();

const program = new Command();

program
  .name('multi-agent')
  .description('Autonomous Coding Agents CLI')
  .version('1.0.0');

program.addCommand(createAutonomousCLI());

program.parse(process.argv);
