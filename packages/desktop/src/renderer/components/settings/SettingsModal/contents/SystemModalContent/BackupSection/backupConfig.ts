/**
 * @license
 * Copyright 2026 DCode (dcodes.site)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMcpServer, IMcpServerTransport, IProvider } from '@/common/config/storage';
import type { Assistant, CreateAssistantRequest } from '@/common/types/agent/assistantTypes';
import type { CreateProviderRequest } from '@/common/types/provider/providerApi';

export const BACKUP_SCHEMA_VERSION = 1 as const;

export type BackupProviderEntry = Omit<CreateProviderRequest, 'id'>;
export type BackupAssistantEntry = CreateAssistantRequest;
export type BackupMcpServerEntry = Pick<IMcpServer, 'name' | 'description' | 'transport' | 'original_json' | 'builtin'>;

export interface BackupFile {
  version: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  providers: BackupProviderEntry[];
  assistants: BackupAssistantEntry[];
  mcpServers: BackupMcpServerEntry[];
}

export interface BackupImportSummary {
  providers: { imported: number; failed: number };
  assistants: { imported: number; skipped: number; failed: number };
  mcpServers: { imported: number; failed: number };
}

export type BackupValidationResult =
  | { valid: true; data: BackupFile }
  | { valid: false; reason: 'invalid-json' | 'missing-version' | 'unsupported-version' };

// Matches keys like api_key, secret_access_key, service_account_json (already
// dropped explicitly for providers), plus anything a user might have named a
// bearer token or password inside an MCP server's stdio env / HTTP headers.
const SECRET_KEY_PATTERN = /(key|token|secret|password|passwd|auth|credential|bearer)/i;

function redactRecordBySecretLikeKeys(record: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!record) return record;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = SECRET_KEY_PATTERN.test(key) ? '' : value;
  }
  return result;
}

function redactTransport(transport: IMcpServerTransport): IMcpServerTransport {
  if (transport.type === 'stdio') {
    return { ...transport, env: redactRecordBySecretLikeKeys(transport.env) };
  }
  return { ...transport, headers: redactRecordBySecretLikeKeys(transport.headers) };
}

/**
 * Rebuilds the `mcpServers` single-entry JSON shape from an already-redacted
 * transport, mirroring `buildOriginalJson` in
 * `renderer/pages/settings/components/JsonImportModal.tsx`. Kept as a local
 * copy (not imported) since that helper isn't exported and has exactly one
 * other caller — duplicating ~15 lines is simpler than promoting it to a
 * shared module for a second consumer.
 */
function buildRedactedOriginalJson(
  name: string,
  description: string | undefined,
  transport: IMcpServerTransport
): string {
  const transportConfig =
    transport.type === 'stdio'
      ? { command: transport.command, args: transport.args || [], env: transport.env || {} }
      : { type: transport.type, url: transport.url, ...(transport.headers ? { headers: transport.headers } : {}) };

  return JSON.stringify(
    {
      mcpServers: {
        [name]: {
          ...(description ? { description } : {}),
          ...transportConfig,
        },
      },
    },
    null,
    2
  );
}

export function redactProvider(provider: IProvider): BackupProviderEntry {
  const { id: _id, model_health: _modelHealth, ...rest } = provider;
  return {
    ...rest,
    api_key: '',
    bedrock_config: provider.bedrock_config
      ? { ...provider.bedrock_config, access_key_id: undefined, secret_access_key: undefined }
      : undefined,
    vertex_config: provider.vertex_config ? { ...provider.vertex_config, service_account_json: undefined } : undefined,
  };
}

export function redactMcpServer(server: IMcpServer): BackupMcpServerEntry {
  const transport = redactTransport(server.transport);
  return {
    name: server.name,
    description: server.description,
    builtin: server.builtin,
    transport,
    original_json: buildRedactedOriginalJson(server.name, server.description, transport),
  };
}

export function assistantToBackupEntry(assistant: Assistant): BackupAssistantEntry {
  return {
    name: assistant.name,
    description: assistant.description,
    avatar: assistant.avatar,
    agent_id: assistant.agent_id,
    enabled_skills: assistant.enabled_skills,
    custom_skill_names: assistant.custom_skill_names,
    disabled_builtin_skills: assistant.disabled_builtin_skills,
    prompts: assistant.prompts,
    models: assistant.models,
    name_i18n: assistant.name_i18n,
    description_i18n: assistant.description_i18n,
    prompts_i18n: assistant.prompts_i18n,
  };
}

export function buildBackupFile(input: {
  providers: IProvider[];
  assistants: Assistant[];
  mcpServers: IMcpServer[];
}): BackupFile {
  return {
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    providers: input.providers.map(redactProvider),
    assistants: input.assistants.filter((a) => a.source === 'user').map(assistantToBackupEntry),
    mcpServers: input.mcpServers.map(redactMcpServer),
  };
}

export function parseBackupFile(raw: string): BackupValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, reason: 'invalid-json' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, reason: 'invalid-json' };
  }

  const candidate = parsed as Partial<BackupFile>;
  if (candidate.version === undefined || candidate.version === null) {
    return { valid: false, reason: 'missing-version' };
  }
  if (candidate.version !== BACKUP_SCHEMA_VERSION) {
    return { valid: false, reason: 'unsupported-version' };
  }

  return {
    valid: true,
    data: {
      version: BACKUP_SCHEMA_VERSION,
      exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : new Date().toISOString(),
      providers: Array.isArray(candidate.providers) ? candidate.providers : [],
      assistants: Array.isArray(candidate.assistants) ? candidate.assistants : [],
      mcpServers: Array.isArray(candidate.mcpServers) ? candidate.mcpServers : [],
    },
  };
}
