import { Settings, ExternalLink } from 'lucide-react';

const envVars = [
  { key: 'LLM_PROVIDER', desc: 'LLM provider', example: 'claude' },
  { key: 'ANTHROPIC_API_KEY', desc: 'Anthropic API key', example: 'sk-ant-***' },
  { key: 'OPENAI_API_KEY', desc: 'OpenAI API key', example: 'sk-***' },
  { key: 'GEMINI_API_KEY', desc: 'Gemini API key', example: '***' },
  { key: 'GITHUB_TOKEN', desc: 'GitHub token', example: 'ghp_***' },
  { key: 'GITHUB_OWNER', desc: 'GitHub owner', example: 'your-username' },
  { key: 'MAX_CONCURRENT_TASKS', desc: 'Max parallel tasks', example: '3' },
  { key: 'LOG_LEVEL', desc: 'Log level', example: 'info' },
  { key: 'ROUTING_ENABLED', desc: 'Multi-model routing', example: 'false' },
];

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Settings className="w-5 h-5" /> Settings
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold">Environment Variables</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure via <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env</code> file.
            Restart required after changes.
          </p>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {envVars.map((v) => (
            <div key={v.key} className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <code className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {v.key}
                </code>
                <p className="text-xs text-gray-500">{v.desc}</p>
              </div>
              <code className="text-xs text-gray-400">{v.example}</code>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold mb-3">Resources</h2>
        <div className="space-y-2">
          {[
            { label: 'User Guide', href: '/docs/03-guides/USER_GUIDE.md' },
            { label: 'API Documentation (OpenAPI)', href: '/docs/api/openapi.yaml' },
            { label: 'CLI Usage', href: '/docs/03-guides/CLI_USAGE.md' },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
