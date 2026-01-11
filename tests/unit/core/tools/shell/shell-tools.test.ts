/**
 * Shell Tools Tests
 */

import {
  ShellExecTool,
  ShellCommandTool,
  ShellScriptTool,
  ShellEnvTool,
  ShellWhichTool,
  ShellPipeTool,
  ShellValidateTool,
  createShellTools,
  getAllShellTools,
} from '../../../../../src/core/tools/shell/index.js';
import { ToolCategory } from '../../../../../src/core/interfaces/tool.interface.js';
import {
  MockShellClient,
  createMockShellResult,
  createMockCommandLocation,
} from './mock-shell-client.js';

describe('Shell Tools', () => {
  let mockClient: MockShellClient;

  beforeEach(() => {
    mockClient = new MockShellClient();
  });

  describe('ShellExecTool', () => {
    let tool: ShellExecTool;

    beforeEach(() => {
      tool = new ShellExecTool(mockClient);
    });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('shell-exec');
      expect(tool.getCategory()).toBe(ToolCategory.SHELL);
      expect(tool.schema.tags).toContain('shell');
      expect(tool.schema.parameters.length).toBe(4);
    });

    it('should execute a shell command', async () => {
      mockClient.execResponse = {
        success: true,
        data: createMockShellResult({
          stdout: 'Hello World',
          exitCode: 0,
        }),
      };

      const result = await tool.execute({ command: 'echo "Hello World"' });

      expect(result.success).toBe(true);
      expect(result.data?.stdout).toBe('Hello World');
      expect(result.data?.exitCode).toBe(0);
    });

    it('should pass options to client', async () => {
      await tool.execute({
        command: 'ls',
        cwd: '/tmp',
        timeout: 5000,
      });

      expect(mockClient.calls).toContainEqual({
        method: 'exec',
        args: ['ls', { cwd: '/tmp', timeout: 5000, env: undefined }],
      });
    });

    it('should fail with empty command', async () => {
      const result = await tool.execute({ command: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should handle execution errors', async () => {
      mockClient.execResponse = {
        success: false,
        error: 'Command not found',
      };

      const result = await tool.execute({ command: 'unknown-command' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SHELL_EXEC_FAILED');
    });

    it('should report timeout', async () => {
      mockClient.execResponse = {
        success: true,
        data: createMockShellResult({
          timedOut: true,
          killed: true,
          exitCode: -1,
        }),
      };

      const result = await tool.execute({ command: 'sleep 100' });

      expect(result.success).toBe(true);
      expect(result.data?.timedOut).toBe(true);
    });

    it('should be available', async () => {
      expect(await tool.isAvailable()).toBe(true);
    });
  });

  describe('ShellCommandTool', () => {
    let tool: ShellCommandTool;

    beforeEach(() => {
      tool = new ShellCommandTool(mockClient);
    });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('shell-command');
      expect(tool.getCategory()).toBe(ToolCategory.SHELL);
      expect(tool.schema.parameters.length).toBe(5);
    });

    it('should execute command with arguments', async () => {
      mockClient.execCommandResponse = {
        success: true,
        data: createMockShellResult({
          stdout: 'file1.txt\nfile2.txt',
          exitCode: 0,
        }),
      };

      const result = await tool.execute({
        command: 'ls',
        args: ['-la', '/tmp'],
      });

      expect(result.success).toBe(true);
      expect(mockClient.calls).toContainEqual({
        method: 'execCommand',
        args: ['ls', ['-la', '/tmp'], { cwd: undefined, env: undefined, timeout: undefined }],
      });
    });

    it('should fail with empty command', async () => {
      const result = await tool.execute({ command: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should handle command without args', async () => {
      await tool.execute({ command: 'pwd' });

      expect(mockClient.calls[0].args[1]).toEqual([]);
    });
  });

  describe('ShellScriptTool', () => {
    let tool: ShellScriptTool;

    beforeEach(() => {
      tool = new ShellScriptTool(mockClient);
    });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('shell-script');
      expect(tool.getCategory()).toBe(ToolCategory.SHELL);
      expect(tool.schema.parameters.length).toBe(6);
    });

    it('should execute a script', async () => {
      mockClient.execScriptResponse = {
        success: true,
        data: createMockShellResult({
          stdout: 'Script output',
          exitCode: 0,
        }),
      };

      const result = await tool.execute({
        path: '/path/to/script.sh',
        args: ['arg1', 'arg2'],
      });

      expect(result.success).toBe(true);
      expect(result.data?.stdout).toBe('Script output');
    });

    it('should pass interpreter option', async () => {
      await tool.execute({
        path: '/path/to/script.py',
        interpreter: 'python3',
      });

      expect(mockClient.calls[0].args[1]).toMatchObject({
        interpreter: 'python3',
      });
    });

    it('should fail with empty path', async () => {
      const result = await tool.execute({ path: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should handle script errors', async () => {
      mockClient.execScriptResponse = {
        success: false,
        error: 'Script not found',
      };

      const result = await tool.execute({ path: '/nonexistent.sh' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SHELL_SCRIPT_FAILED');
    });
  });

  describe('ShellEnvTool', () => {
    let tool: ShellEnvTool;

    beforeEach(() => {
      tool = new ShellEnvTool(mockClient);
    });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('shell-env');
      expect(tool.getCategory()).toBe(ToolCategory.SHELL);
      expect(tool.schema.parameters.length).toBe(3);
    });

    describe('get action', () => {
      it('should get environment variable', async () => {
        const result = await tool.execute({
          action: 'get',
          name: 'PATH',
        });

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          name: 'PATH',
          value: '/usr/bin:/bin',
          exists: true,
        });
      });

      it('should handle non-existent variable', async () => {
        const result = await tool.execute({
          action: 'get',
          name: 'NONEXISTENT_VAR',
        });

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          name: 'NONEXISTENT_VAR',
          exists: false,
        });
      });

      it('should fail without name', async () => {
        const result = await tool.execute({ action: 'get' });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_PARAMS');
      });
    });

    describe('set action', () => {
      it('should set environment variable', async () => {
        const result = await tool.execute({
          action: 'set',
          name: 'MY_VAR',
          value: 'my_value',
        });

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          name: 'MY_VAR',
          value: 'my_value',
          set: true,
        });
      });

      it('should fail without name', async () => {
        const result = await tool.execute({
          action: 'set',
          value: 'value',
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_PARAMS');
      });

      it('should fail without value', async () => {
        const result = await tool.execute({
          action: 'set',
          name: 'MY_VAR',
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_PARAMS');
      });
    });

    describe('list action', () => {
      it('should list all environment variables', async () => {
        const result = await tool.execute({ action: 'list' });

        expect(result.success).toBe(true);
        expect((result.data as any).variables).toBeDefined();
        expect((result.data as any).count).toBeGreaterThan(0);
      });
    });

    it('should fail without action', async () => {
      const result = await tool.execute({} as any);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('ShellWhichTool', () => {
    let tool: ShellWhichTool;

    beforeEach(() => {
      tool = new ShellWhichTool(mockClient);
    });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('shell-which');
      expect(tool.getCategory()).toBe(ToolCategory.SHELL);
      expect(tool.schema.parameters.length).toBe(1);
    });

    it('should find command location', async () => {
      mockClient.whichResponse = {
        success: true,
        data: createMockCommandLocation({
          command: 'node',
          path: '/usr/bin/node',
          exists: true,
          isExecutable: true,
        }),
      };

      const result = await tool.execute({ command: 'node' });

      expect(result.success).toBe(true);
      expect(result.data?.path).toBe('/usr/bin/node');
      expect(result.data?.exists).toBe(true);
      expect(result.data?.isExecutable).toBe(true);
    });

    it('should handle non-existent command', async () => {
      mockClient.whichResponse = {
        success: true,
        data: createMockCommandLocation({
          command: 'nonexistent',
          path: '',
          exists: false,
          isExecutable: false,
        }),
      };

      const result = await tool.execute({ command: 'nonexistent' });

      expect(result.success).toBe(true);
      expect(result.data?.exists).toBe(false);
    });

    it('should identify builtin commands', async () => {
      mockClient.whichResponse = {
        success: true,
        data: createMockCommandLocation({
          command: 'cd',
          path: '',
          exists: true,
          isExecutable: true,
          isBuiltin: true,
        }),
      };

      const result = await tool.execute({ command: 'cd' });

      expect(result.success).toBe(true);
      expect(result.data?.isBuiltin).toBe(true);
    });

    it('should fail with empty command', async () => {
      const result = await tool.execute({ command: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('ShellPipeTool', () => {
    let tool: ShellPipeTool;

    beforeEach(() => {
      tool = new ShellPipeTool(mockClient);
    });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('shell-pipe');
      expect(tool.getCategory()).toBe(ToolCategory.SHELL);
      expect(tool.schema.parameters.length).toBe(4);
    });

    it('should execute piped commands', async () => {
      mockClient.execPipeResponse = {
        success: true,
        data: createMockShellResult({
          stdout: 'file.ts',
          exitCode: 0,
        }),
      };

      const result = await tool.execute({
        commands: [
          { command: 'ls' },
          { command: 'grep', args: ['.ts'] },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data?.commandCount).toBe(2);
    });

    it('should fail with empty commands', async () => {
      const result = await tool.execute({ commands: [] });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should fail with empty command in array', async () => {
      const result = await tool.execute({
        commands: [{ command: 'ls' }, { command: '' }],
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should handle pipe errors', async () => {
      mockClient.execPipeResponse = {
        success: false,
        error: 'Pipe execution failed',
      };

      const result = await tool.execute({
        commands: [{ command: 'ls' }],
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SHELL_PIPE_FAILED');
    });
  });

  describe('ShellValidateTool', () => {
    let tool: ShellValidateTool;

    beforeEach(() => {
      tool = new ShellValidateTool(mockClient);
    });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('shell-validate');
      expect(tool.getCategory()).toBe(ToolCategory.SHELL);
      expect(tool.schema.parameters.length).toBe(1);
    });

    it('should validate allowed command', async () => {
      mockClient.validateCommandResponse = { success: true };

      const result = await tool.execute({ command: 'ls -la' });

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.reason).toBeUndefined();
    });

    it('should reject blocked command', async () => {
      mockClient.validateCommandResponse = {
        success: false,
        error: "Command 'rm' is blocked by sandbox rules",
      };

      const result = await tool.execute({ command: 'rm -rf /' });

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.reason).toContain('blocked');
    });

    it('should include sandbox config in output', async () => {
      const result = await tool.execute({ command: 'echo test' });

      expect(result.success).toBe(true);
      expect(result.data?.sandboxConfig).toBeDefined();
      expect(typeof result.data?.sandboxConfig.allowNetwork).toBe('boolean');
    });

    it('should fail with empty command', async () => {
      const result = await tool.execute({ command: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('createShellTools', () => {
    it('should create all shell tools', () => {
      const tools = createShellTools({ shellClient: mockClient });

      expect(tools.exec).toBeInstanceOf(ShellExecTool);
      expect(tools.command).toBeInstanceOf(ShellCommandTool);
      expect(tools.script).toBeInstanceOf(ShellScriptTool);
      expect(tools.env).toBeInstanceOf(ShellEnvTool);
      expect(tools.which).toBeInstanceOf(ShellWhichTool);
      expect(tools.pipe).toBeInstanceOf(ShellPipeTool);
      expect(tools.validate).toBeInstanceOf(ShellValidateTool);
    });

    it('should share the same client', async () => {
      const tools = createShellTools({ shellClient: mockClient });

      await tools.exec.execute({ command: 'echo 1' });
      await tools.command.execute({ command: 'echo', args: ['2'] });

      expect(mockClient.calls.length).toBe(2);
    });
  });

  describe('getAllShellTools', () => {
    it('should return all tools as array', () => {
      const tools = getAllShellTools({ shellClient: mockClient });

      expect(tools).toHaveLength(7);
      expect(tools.map((t) => t.name)).toEqual([
        'shell-exec',
        'shell-command',
        'shell-script',
        'shell-env',
        'shell-which',
        'shell-pipe',
        'shell-validate',
      ]);
    });

    it('should return tools with correct category', () => {
      const tools = getAllShellTools({ shellClient: mockClient });

      tools.forEach((tool) => {
        expect(tool.getCategory()).toBe(ToolCategory.SHELL);
      });
    });
  });
});

describe('Shell Client Integration', () => {
  describe('Sandbox Security', () => {
    let mockClient: MockShellClient;
    let tool: ShellExecTool;

    beforeEach(() => {
      mockClient = new MockShellClient();
      tool = new ShellExecTool(mockClient);
    });

    it('should block dangerous commands', async () => {
      mockClient.validateCommandResponse = {
        success: false,
        error: "Command 'rm' is blocked by sandbox rules",
      };
      mockClient.execResponse = {
        success: false,
        error: "Command 'rm' is blocked by sandbox rules",
      };

      const result = await tool.execute({ command: 'rm -rf /' });

      expect(result.success).toBe(false);
    });

    it('should block command injection patterns', async () => {
      mockClient.validateCommandResponse = {
        success: false,
        error: 'Command matches blocked pattern',
      };
      mockClient.execResponse = {
        success: false,
        error: 'Command matches blocked pattern',
      };

      const result = await tool.execute({ command: 'echo test; rm -rf /' });

      expect(result.success).toBe(false);
    });
  });

  describe('Environment Variables', () => {
    let tool: ShellEnvTool;
    let mockClient: MockShellClient;

    beforeEach(() => {
      mockClient = new MockShellClient();
      tool = new ShellEnvTool(mockClient);
    });

    it('should persist set variables', async () => {
      await tool.execute({
        action: 'set',
        name: 'CUSTOM_VAR',
        value: 'custom_value',
      });

      const getResult = await tool.execute({
        action: 'get',
        name: 'CUSTOM_VAR',
      });

      expect(getResult.data).toMatchObject({
        name: 'CUSTOM_VAR',
        value: 'custom_value',
        exists: true,
      });
    });

    it('should block blocked env vars', async () => {
      mockClient.sandboxConfig.blockedEnvVars = ['SECRET_KEY'];

      const result = await tool.execute({
        action: 'set',
        name: 'SECRET_KEY',
        value: 'secret',
      });

      expect(result.success).toBe(false);
    });
  });
});
