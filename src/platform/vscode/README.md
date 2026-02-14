# ACA - Autonomous Coding Agents

**Orchestrate autonomous coding agents directly from VS Code.**

ACA brings multi-agent task orchestration into your editor. Submit tasks, monitor agent progress in real time, and review results without leaving VS Code.

---

## Features

- **Task Submission and Monitoring** -- Submit coding tasks through the command palette or the built-in webview panel. Track every task from submission through completion.

- **Real-Time Status Updates via SSE** -- Server-Sent Events deliver live progress updates, completion notifications, and error reports as they happen.

- **Agent Monitoring Sidebar** -- A dedicated activity bar panel lists all registered agents with their current state (idle, working, error) and assigned tasks.

- **Task Detail Webview** -- Click any task to open a rich detail view with a status timeline, progress bar, live log stream, and result or error output.

- **Connection Status Bar** -- The status bar shows the current server connection state at a glance. Click to submit a new task.

- **Configurable Server URL and Authentication** -- Point the extension at any ACA server instance and optionally provide an auth token.

---

## Requirements

- **Node.js** 18 or later
- **ACA Server** running and accessible over HTTP or HTTPS
- **VS Code** 1.85.0 or later

---

## Installation

### From the Marketplace

Search for **ACA - Autonomous Coding Agents** in the VS Code Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`) and click **Install**.

### From VSIX

1. Download the `.vsix` file from the [Releases](https://github.com/aca-team/aca-vscode/releases) page.
2. Open VS Code and run **Extensions: Install from VSIX...** from the command palette.
3. Select the downloaded file.

---

## Configuration

All settings are under the `aca` namespace. Open **Settings** (`Ctrl+,` / `Cmd+,`) and search for `aca`.

| Setting | Type | Default | Description |
|---|---|---|---|
| `aca.serverUrl` | `string` | `http://localhost:3000` | URL of the ACA API server |
| `aca.autoConnect` | `boolean` | `true` | Automatically connect to the ACA server on startup |
| `aca.showNotifications` | `boolean` | `true` | Show notification messages for ACA events |

---

## Commands

Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type **ACA** to see all available commands.

| Command | Description |
|---|---|
| `ACA: Submit Task` | Open an input box to describe and submit a new task |
| `ACA: Show Status` | Open the task webview panel for submission and monitoring |
| `ACA: Show Agents` | Refresh the agents sidebar with current data from the server |
| `ACA: Stop Current Task` | Stop the currently running task (with confirmation) |
| `ACA: Show Logs` | Open the ACA output channel to view extension logs |
| `ACA: Configure Settings` | Open VS Code settings filtered to ACA configuration |
| `ACA: Show Task Detail` | Open a detailed view for a specific task (via sidebar click) |

---

## Screenshots

> Screenshots will be added before the first marketplace release.

- **Task Webview Panel** -- `assets/screenshots/task-panel.png`
- **Agent Sidebar** -- `assets/screenshots/agent-sidebar.png`
- **Task Detail View** -- `assets/screenshots/task-detail.png`
- **Status Bar** -- `assets/screenshots/status-bar.png`

---

## Troubleshooting

### Server not running

If the status bar shows **ACA: Error** or **ACA: Disconnected**, verify that the ACA server is running at the configured URL. Check with:

```bash
curl http://localhost:3000/api/health
```

### Authentication token

If the server requires authentication, set the token through the ACA client configuration. The extension sends it as a `Bearer` token in the `Authorization` header.

### Firewall or network issues

Ensure that the ACA server port is accessible from your machine. If running in a container or remote environment, verify port forwarding is configured.

### Extension not activating

The extension activates on startup. Check the **ACA** output channel (`ACA: Show Logs`) for activation messages and error details.

---

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
cd src/platform/vscode
npm install
```

### Build

```bash
npm run compile
```

### Watch mode

```bash
npm run watch
```

### Run in development

Press `F5` in VS Code with the extension directory open. This launches a new Extension Development Host window with the extension loaded.

### Package for distribution

```bash
npm run package
```

This produces a `.vsix` file in the extension directory.

### Publish to marketplace

```bash
npm run publish
```

Requires a valid Personal Access Token configured with `vsce`.

---

## License

MIT
