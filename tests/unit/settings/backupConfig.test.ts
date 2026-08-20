/**
 * @license
 * Copyright 2026 DCode (dcodes.site)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { IMcpServer, IProvider } from '@/common/config/storage';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import {
  BACKUP_SCHEMA_VERSION,
  assistantToBackupEntry,
  buildBackupFile,
  parseBackupFile,
  redactMcpServer,
  redactProvider,
} from '@/renderer/components/settings/SettingsModal/contents/SystemModalContent/BackupSection/backupConfig';

const baseProvider: IProvider = {
  id: 'prov-1',
  platform: 'openai',
  name: 'My OpenAI',
  base_url: 'https://api.openai.com/v1',
  api_key: 'sk-super-secret',
  models: ['gpt-4o'],
  enabled: true,
  model_health: { 'gpt-4o': { status: 'healthy' } },
};

const bedrockProvider: IProvider = {
  ...baseProvider,
  id: 'prov-2',
  platform: 'bedrock',
  bedrock_config: {
    auth_method: 'accessKey',
    region: 'us-east-1',
    access_key_id: 'AKIA-real-key',
    secret_access_key: 'shh-do-not-export-me',
  },
};

const vertexProvider: IProvider = {
  ...baseProvider,
  id: 'prov-3',
  platform: 'vertex-ai',
  vertex_config: {
    auth_method: 'serviceAccount',
    project_id: 'my-project',
    location: 'us-central1',
    service_account_json: '{"type":"service_account","private_key":"..."}',
  },
};

const baseAssistant: Assistant = {
  id: 'assist-1',
  source: 'user',
  name: 'Research Assistant',
  name_i18n: {},
  description: 'Helps with research',
  description_i18n: {},
  enabled: true,
  sort_order: 0,
  agent_id: 'claude-code',
  enabled_skills: ['skill-a'],
  custom_skill_names: [],
  disabled_builtin_skills: [],
  context_i18n: {},
  prompts: ['Do research'],
  prompts_i18n: {},
  models: ['claude-sonnet'],
  agent_status: 'online',
  team_selectable: true,
  deletable: true,
};

const stdioMcpServer: IMcpServer = {
  id: 'mcp-1',
  name: 'filesystem',
  description: 'Local filesystem access',
  enabled: true,
  transport: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@mcp/fs'],
    env: { API_KEY: 'super-secret-token', NODE_ENV: 'production' },
  },
  created_at: 1000,
  updated_at: 1000,
  original_json:
    '{"mcpServers":{"filesystem":{"command":"npx","args":["-y","@mcp/fs"],"env":{"API_KEY":"super-secret-token"}}}}',
};

const httpMcpServer: IMcpServer = {
  id: 'mcp-2',
  name: 'remote-api',
  enabled: true,
  transport: {
    type: 'http',
    url: 'https://example.com/mcp',
    headers: { Authorization: 'Bearer sk-abc123', 'X-Client': 'dcode' },
  },
  created_at: 1000,
  updated_at: 1000,
  original_json:
    '{"mcpServers":{"remote-api":{"type":"http","url":"https://example.com/mcp","headers":{"Authorization":"Bearer sk-abc123"}}}}',
};

describe('redactProvider', () => {
  it('strips the API key but keeps the field present', () => {
    const result = redactProvider(baseProvider);
    expect(result.api_key).toBe('');
    expect('api_key' in result).toBe(true);
  });

  it('drops id and model_health entirely', () => {
    const result = redactProvider(baseProvider);
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('model_health');
  });

  it('strips bedrock access key and secret access key, keeps region/auth_method', () => {
    const result = redactProvider(bedrockProvider);
    expect(result.bedrock_config?.access_key_id).toBeUndefined();
    expect(result.bedrock_config?.secret_access_key).toBeUndefined();
    expect(result.bedrock_config?.region).toBe('us-east-1');
    expect(result.bedrock_config?.auth_method).toBe('accessKey');
  });

  it('strips vertex service_account_json, keeps project_id/location', () => {
    const result = redactProvider(vertexProvider);
    expect(result.vertex_config?.service_account_json).toBeUndefined();
    expect(result.vertex_config?.project_id).toBe('my-project');
    expect(result.vertex_config?.location).toBe('us-central1');
  });

  it('keeps non-secret fields as-is', () => {
    const result = redactProvider(baseProvider);
    expect(result.platform).toBe('openai');
    expect(result.name).toBe('My OpenAI');
    expect(result.models).toEqual(['gpt-4o']);
  });

  it('handles providers with no bedrock_config/vertex_config (undefined stays undefined)', () => {
    const result = redactProvider(baseProvider);
    expect(result.bedrock_config).toBeUndefined();
    expect(result.vertex_config).toBeUndefined();
  });
});

describe('redactMcpServer', () => {
  it('blanks only secret-looking env keys for stdio transport, keeps others', () => {
    const result = redactMcpServer(stdioMcpServer);
    if (result.transport.type !== 'stdio') throw new Error('expected stdio transport');
    expect(result.transport.env?.API_KEY).toBe('');
    expect(result.transport.env?.NODE_ENV).toBe('production');
  });

  it('blanks only secret-looking header keys for http transport, keeps others', () => {
    const result = redactMcpServer(httpMcpServer);
    if (result.transport.type === 'stdio') throw new Error('expected non-stdio transport');
    expect(result.transport.headers?.Authorization).toBe('');
    expect(result.transport.headers?.['X-Client']).toBe('dcode');
  });

  it('drops runtime-state fields (id, created_at, updated_at)', () => {
    const result = redactMcpServer(stdioMcpServer);
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('created_at');
    expect(result).not.toHaveProperty('updated_at');
  });

  it('regenerates original_json from the redacted transport, containing no secret substring', () => {
    const result = redactMcpServer(stdioMcpServer);
    expect(result.original_json).not.toContain('super-secret-token');
    expect(result.original_json).toContain('filesystem');
  });

  it('regenerates original_json for http transport without the secret header value', () => {
    const result = redactMcpServer(httpMcpServer);
    expect(result.original_json).not.toContain('sk-abc123');
  });

  it('handles a transport with no env/headers at all', () => {
    const bareServer: IMcpServer = {
      ...stdioMcpServer,
      transport: { type: 'stdio', command: 'npx' },
    };
    const result = redactMcpServer(bareServer);
    if (result.transport.type !== 'stdio') throw new Error('expected stdio transport');
    expect(result.transport.env).toBeUndefined();
  });
});

describe('assistantToBackupEntry', () => {
  it('maps portable fields and excludes runtime-state fields', () => {
    const result = assistantToBackupEntry(baseAssistant);
    expect(result.name).toBe('Research Assistant');
    expect(result.agent_id).toBe('claude-code');
    expect(result.enabled_skills).toEqual(['skill-a']);
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('source');
    expect(result).not.toHaveProperty('enabled');
    expect(result).not.toHaveProperty('sort_order');
    expect(result).not.toHaveProperty('agent_status');
    expect(result).not.toHaveProperty('deletable');
  });
});

describe('buildBackupFile', () => {
  it('stamps the current schema version and a parseable exportedAt timestamp', () => {
    const result = buildBackupFile({ providers: [], assistants: [], mcpServers: [] });
    expect(result.version).toBe(BACKUP_SCHEMA_VERSION);
    expect(Number.isNaN(Date.parse(result.exportedAt))).toBe(false);
  });

  it('filters assistants to source === "user" only', () => {
    const builtinAssistant: Assistant = { ...baseAssistant, id: 'assist-2', source: 'builtin', name: 'Builtin' };
    const generatedAssistant: Assistant = { ...baseAssistant, id: 'assist-3', source: 'generated', name: 'Generated' };
    const result = buildBackupFile({
      providers: [],
      assistants: [baseAssistant, builtinAssistant, generatedAssistant],
      mcpServers: [],
    });
    expect(result.assistants).toHaveLength(1);
    expect(result.assistants[0]?.name).toBe('Research Assistant');
  });

  it('redacts providers and MCP servers via the same functions tested above', () => {
    const result = buildBackupFile({ providers: [baseProvider], assistants: [], mcpServers: [stdioMcpServer] });
    expect(result.providers[0]?.api_key).toBe('');
    const transport = result.mcpServers[0]?.transport;
    expect(transport?.type === 'stdio' && transport.env?.API_KEY).toBe('');
  });

  it('produces empty arrays when given no data', () => {
    const result = buildBackupFile({ providers: [], assistants: [], mcpServers: [] });
    expect(result.providers).toEqual([]);
    expect(result.assistants).toEqual([]);
    expect(result.mcpServers).toEqual([]);
  });
});

describe('parseBackupFile', () => {
  it('accepts a valid backup file', () => {
    const raw = JSON.stringify({
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      providers: [],
      assistants: [],
      mcpServers: [],
    });
    const result = parseBackupFile(raw);
    expect(result.valid).toBe(true);
  });

  it('rejects malformed JSON', () => {
    const result = parseBackupFile('{not valid json');
    expect(result).toEqual({ valid: false, reason: 'invalid-json' });
  });

  it('rejects a JSON value that is not an object (e.g. an array)', () => {
    const result = parseBackupFile('[1,2,3]');
    expect(result).toEqual({ valid: false, reason: 'invalid-json' });
  });

  it('rejects null', () => {
    const result = parseBackupFile('null');
    expect(result).toEqual({ valid: false, reason: 'invalid-json' });
  });

  it('rejects a file missing the version field', () => {
    const result = parseBackupFile(JSON.stringify({ providers: [], assistants: [], mcpServers: [] }));
    expect(result).toEqual({ valid: false, reason: 'missing-version' });
  });

  it('rejects an unsupported (future) version', () => {
    const result = parseBackupFile(JSON.stringify({ version: 2, providers: [], assistants: [], mcpServers: [] }));
    expect(result).toEqual({ valid: false, reason: 'unsupported-version' });
  });

  it('rejects version 0 as unsupported rather than treating it as falsy-missing', () => {
    const result = parseBackupFile(JSON.stringify({ version: 0, providers: [], assistants: [], mcpServers: [] }));
    expect(result).toEqual({ valid: false, reason: 'unsupported-version' });
  });

  it('defaults missing category arrays to empty rather than throwing', () => {
    const result = parseBackupFile(JSON.stringify({ version: 1 }));
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.providers).toEqual([]);
      expect(result.data.assistants).toEqual([]);
      expect(result.data.mcpServers).toEqual([]);
    }
  });
});
