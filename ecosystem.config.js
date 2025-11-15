/**
 * PM2 Ecosystem Configuration
 *
 * Manages all agent processes for 24/7 autonomous operation.
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop ecosystem.config.js
 *   pm2 restart ecosystem.config.js
 *   pm2 logs
 *   pm2 monit
 *
 * Feature: F5.2 - Process Manager Integration
 */

module.exports = {
  apps: [
    {
      name: 'health-server',
      script: 'dist/bin/start-health-server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        HEALTH_PORT: 3000,
        HEALTH_HOST: '0.0.0.0',
      },
      error_file: 'logs/health-server-error.log',
      out_file: 'logs/health-server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
    },
    {
      name: 'coder-agent',
      script: 'dist/bin/start-coder.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        AGENT_ID: 'coder-1',
        AGENT_NAME: 'Coder Agent',
      },
      error_file: 'logs/coder-agent-error.log',
      out_file: 'logs/coder-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
    },
    {
      name: 'reviewer-agent',
      script: 'dist/bin/start-reviewer.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        AGENT_ID: 'reviewer-1',
        AGENT_NAME: 'Reviewer Agent',
      },
      error_file: 'logs/reviewer-agent-error.log',
      out_file: 'logs/reviewer-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
    },
    {
      name: 'repo-manager-agent',
      script: 'dist/bin/start-repo-manager.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        AGENT_ID: 'repo-manager-1',
        AGENT_NAME: 'Repo Manager Agent',
      },
      error_file: 'logs/repo-manager-agent-error.log',
      out_file: 'logs/repo-manager-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
    },
  ],
};
