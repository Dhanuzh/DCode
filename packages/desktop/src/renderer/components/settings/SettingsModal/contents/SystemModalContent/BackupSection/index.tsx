/**
 * @license
 * Copyright 2026 DCode (dcodes.site)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import AionModal from '@/renderer/components/base/AionModal';
import { joinFilePath, normalizeExportFileName } from '@/renderer/utils/chat/conversationExport';
import { copyText } from '@/renderer/utils/ui/clipboard';
import { Button, Input, Message } from '@arco-design/web-react';
import { Download, FolderOpen, Upload } from '@icon-park/react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PreferenceRow from '../PreferenceRow';
import { type BackupImportSummary, buildBackupFile, parseBackupFile } from './backupConfig';

const DEFAULT_EXPORT_DIR_NAME = 'desktop' as const;

function buildDefaultBackupFileName(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `dcode-backup-${stamp}.json`;
}

const BackupSection: React.FC = () => {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportDir, setExportDir] = useState('');
  const [exportFileName, setExportFileName] = useState(buildDefaultBackupFileName());

  const openExportModal = useCallback(async () => {
    let desktopPath = '';
    try {
      desktopPath = await ipcBridge.application.getPath.invoke({ name: DEFAULT_EXPORT_DIR_NAME });
    } catch {
      desktopPath = '';
    }
    setExportDir(desktopPath);
    setExportFileName(buildDefaultBackupFileName());
    setExportModalVisible(true);
  }, []);

  const handlePickExportDir = useCallback(async () => {
    const files = await ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory', 'createDirectory'] });
    if (files && files[0]) {
      setExportDir(files[0]);
    }
  }, []);

  const handleConfirmExport = useCallback(async () => {
    if (!exportDir) {
      Message.error(t('settings.backup.exportNoDir'));
      return;
    }
    setExporting(true);
    try {
      const [providers, assistants, mcpServers] = await Promise.all([
        ipcBridge.mode.listProviders.invoke(),
        ipcBridge.assistants.list.invoke(),
        ipcBridge.mcpService.listServers.invoke(),
      ]);
      const backup = buildBackupFile({ providers, assistants, mcpServers });
      const fileName = normalizeExportFileName(exportFileName) || buildDefaultBackupFileName();
      const targetPath = joinFilePath(exportDir, fileName);
      const success = await ipcBridge.fs.writeFile.invoke({
        path: targetPath,
        data: JSON.stringify(backup, null, 2),
        workspace: exportDir,
      });

      if (!success) {
        Message.error(t('settings.backup.exportFailed'));
        return;
      }

      Message.success({
        content: (
          <div className='flex flex-col gap-8px'>
            <div>{t('settings.backup.exportSuccess', { path: targetPath })}</div>
            <div className='flex justify-end'>
              <Button
                size='mini'
                type='text'
                onClick={() => {
                  void copyText(targetPath)
                    .then(() => Message.success(t('common.copySuccess')))
                    .catch(() => Message.error(t('common.copyFailed')));
                }}
              >
                {t('messages.copy')}
              </Button>
            </div>
          </div>
        ),
        duration: 5000,
      });
      setExportModalVisible(false);
    } catch (error) {
      console.error('[BackupSection] Failed to export configuration:', error);
      Message.error(t('settings.backup.exportFailed'));
    } finally {
      setExporting(false);
    }
  }, [exportDir, exportFileName, t]);

  const handleImport = useCallback(async () => {
    const files = await ipcBridge.dialog.showOpen.invoke({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    const filePath = files?.[0];
    if (!filePath) {
      return;
    }

    setImporting(true);
    try {
      const raw = await ipcBridge.fs.readFile.invoke({ path: filePath });
      if (!raw) {
        Message.error(t('settings.backup.importReadFailed'));
        return;
      }

      const result = parseBackupFile(raw);
      if (result.valid === false) {
        const reasonKey =
          result.reason === 'invalid-json'
            ? 'importInvalidJson'
            : result.reason === 'missing-version'
              ? 'importMissingVersion'
              : 'importUnsupportedVersion';
        Message.error(t(`settings.backup.${reasonKey}`));
        return;
      }

      const summary: BackupImportSummary = {
        providers: { imported: 0, failed: 0 },
        assistants: { imported: 0, skipped: 0, failed: 0 },
        mcpServers: { imported: 0, failed: 0 },
      };

      // Providers: no bulk-create endpoint exists, loop the single-item one.
      // Sequential (not Promise.all) so one slow/failing provider doesn't
      // race the others against the same backend connection pool.
      for (const providerEntry of result.data.providers) {
        try {
          await ipcBridge.mode.createProvider.invoke(providerEntry);
          summary.providers.imported += 1;
        } catch (error) {
          console.error('[BackupSection] Failed to import provider:', providerEntry.name, error);
          summary.providers.failed += 1;
        }
      }

      try {
        const assistantResult = await ipcBridge.assistants.import.invoke({ assistants: result.data.assistants });
        summary.assistants = {
          imported: assistantResult.imported,
          skipped: assistantResult.skipped,
          failed: assistantResult.failed,
        };
        if (assistantResult.errors.length > 0) {
          console.error('[BackupSection] Assistant import errors:', assistantResult.errors);
        }
      } catch (error) {
        console.error('[BackupSection] Failed to import assistants:', error);
        summary.assistants.failed = result.data.assistants.length;
      }

      try {
        const createdServers = await ipcBridge.mcpService.importServers.invoke({ servers: result.data.mcpServers });
        summary.mcpServers.imported = createdServers.length;
        summary.mcpServers.failed = result.data.mcpServers.length - createdServers.length;
      } catch (error) {
        console.error('[BackupSection] Failed to import MCP servers:', error);
        summary.mcpServers.failed = result.data.mcpServers.length;
      }

      const totalFailed = summary.providers.failed + summary.assistants.failed + summary.mcpServers.failed;
      Message.success({
        content: (
          <div className='flex flex-col gap-4px'>
            <div>
              {t('settings.backup.importSummary', {
                providers: summary.providers.imported,
                assistants: summary.assistants.imported,
                mcpServers: summary.mcpServers.imported,
              })}
            </div>
            {summary.providers.imported > 0 && (
              <div className='text-12px text-t-tertiary'>{t('settings.backup.importApiKeyReminder')}</div>
            )}
            {totalFailed > 0 && (
              <div className='text-12px text-warning'>
                {t('settings.backup.importPartialFailure', { count: totalFailed })}
              </div>
            )}
          </div>
        ),
        duration: 6000,
      });
    } catch (error) {
      console.error('[BackupSection] Failed to import configuration:', error);
      Message.error(t('settings.backup.importReadFailed'));
    } finally {
      setImporting(false);
    }
  }, [t]);

  return (
    <div className='px-[12px] md:px-[32px] py-[24px] bg-2 rd-12px md:rd-16px border border-border-2'>
      <div className='text-14px text-t-primary mb-4px'>{t('settings.backup.title')}</div>
      <PreferenceRow label={t('settings.backup.exportLabel')} description={t('settings.backup.exportDesc')}>
        <Button
          size='small'
          icon={<Download theme='outline' size='14' />}
          loading={exporting}
          onClick={openExportModal}
        >
          {t('settings.backup.exportButton')}
        </Button>
      </PreferenceRow>
      <PreferenceRow label={t('settings.backup.importLabel')} description={t('settings.backup.importDesc')}>
        <Button size='small' icon={<Upload theme='outline' size='14' />} loading={importing} onClick={handleImport}>
          {t('settings.backup.importButton')}
        </Button>
      </PreferenceRow>

      <AionModal
        variant='standard'
        visible={exportModalVisible}
        header={{ title: t('settings.backup.exportModalTitle'), showClose: true }}
        onCancel={() => setExportModalVisible(false)}
        style={{ width: 480 }}
        unmountOnExit
        footer={{
          render: () => (
            <div className='flex justify-end gap-10px'>
              <Button onClick={() => setExportModalVisible(false)}>{t('common.cancel')}</Button>
              <Button type='primary' loading={exporting} onClick={handleConfirmExport}>
                {t('settings.backup.exportConfirm')}
              </Button>
            </div>
          ),
        }}
      >
        <div className='flex flex-col gap-12px'>
          <div>
            <div className='text-12px text-t-tertiary mb-4px'>{t('settings.backup.exportFolderLabel')}</div>
            <div className='flex gap-8px'>
              <Input value={exportDir} readOnly placeholder={t('settings.backup.exportFolderLabel')} />
              <Button icon={<FolderOpen theme='outline' size='14' />} onClick={handlePickExportDir} />
            </div>
          </div>
          <div>
            <div className='text-12px text-t-tertiary mb-4px'>{t('settings.backup.exportFilenamePlaceholder')}</div>
            <Input
              value={exportFileName}
              onChange={setExportFileName}
              placeholder={t('settings.backup.exportFilenamePlaceholder')}
            />
          </div>
        </div>
      </AionModal>
    </div>
  );
};

export default BackupSection;
