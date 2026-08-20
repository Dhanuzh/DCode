/**
 * @license
 * Copyright 2026 DCode (dcodes.site)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import { Button, Input, Message, Modal } from '@arco-design/web-react';
import { Close, Plus } from '@icon-park/react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTagActions } from '../hooks/useTagActions';
import { useTagColors } from '../hooks/useTagColors';
import { deriveTagSet, TAG_COLOR_PALETTE } from '../utils/tagHelpers';
import TagChip from './TagChip';

type TagManageModalProps = {
  visible: boolean;
  onClose: () => void;
  conversations: TChatConversation[];
  /** Present = "assign to this conversation" mode. Absent = "manage all tags" mode. */
  conversationId?: string;
  currentTags?: string[];
};

const TagManageModal: React.FC<TagManageModalProps> = ({
  visible,
  onClose,
  conversations,
  conversationId,
  currentTags,
}) => {
  const { t } = useTranslation();
  const { tagColors, getColor, createColorFor, setColor, renameKey, removeColor } = useTagColors();
  const { setConversationTags, renameTagEverywhere, deleteTagEverywhere } = useTagActions(conversations);

  const [newTagName, setNewTagName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busyTag, setBusyTag] = useState<string | null>(null);

  const isAssignMode = conversationId !== undefined;
  const assignedTags = useMemo(() => new Set(currentTags ?? []), [currentTags]);

  const allTags = useMemo(() => {
    const set = new Set(deriveTagSet(conversations));
    for (const name of Object.keys(tagColors)) {
      set.add(name);
    }
    return [...set].toSorted((a, b) => a.localeCompare(b));
  }, [conversations, tagColors]);

  const handleToggleAssigned = useCallback(
    async (name: string, checked: boolean) => {
      if (!conversationId) return;
      const next = checked ? [...(currentTags ?? []), name] : (currentTags ?? []).filter((tag) => tag !== name);
      const success = await setConversationTags(conversationId, next);
      if (!success) {
        Message.error(t('conversation.history.tagUpdateFailed'));
      }
    },
    [conversationId, currentTags, setConversationTags, t]
  );

  const handleAddNewTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name) return;
    if (allTags.includes(name)) {
      Message.error(t('conversation.history.tagDuplicateName'));
      return;
    }
    setAdding(true);
    try {
      await createColorFor(name);
      if (isAssignMode && conversationId) {
        const success = await setConversationTags(conversationId, [...(currentTags ?? []), name]);
        if (!success) {
          Message.error(t('conversation.history.tagUpdateFailed'));
        }
      }
      setNewTagName('');
    } finally {
      setAdding(false);
    }
  }, [allTags, conversationId, createColorFor, currentTags, isAssignMode, newTagName, setConversationTags, t]);

  const startRename = useCallback((name: string) => {
    setEditingTag(name);
    setEditingName(name);
  }, []);

  const commitRename = useCallback(async () => {
    if (!editingTag) return;
    const nextName = editingName.trim();
    if (!nextName || nextName === editingTag) {
      setEditingTag(null);
      return;
    }
    if (allTags.includes(nextName)) {
      Message.error(t('conversation.history.tagDuplicateName'));
      return;
    }
    setBusyTag(editingTag);
    try {
      const success = await renameTagEverywhere(editingTag, nextName);
      if (success) {
        await renameKey(editingTag, nextName);
        setEditingTag(null);
      } else {
        Message.error(t('conversation.history.tagRenameFailed'));
      }
    } finally {
      setBusyTag(null);
    }
  }, [allTags, editingName, editingTag, renameKey, renameTagEverywhere, t]);

  const handleRecolor = useCallback(
    async (name: string) => {
      const currentIndex = TAG_COLOR_PALETTE.indexOf(getColor(name) as (typeof TAG_COLOR_PALETTE)[number]);
      const nextColor = TAG_COLOR_PALETTE[(currentIndex + 1 + TAG_COLOR_PALETTE.length) % TAG_COLOR_PALETTE.length];
      await setColor(name, nextColor);
    },
    [getColor, setColor]
  );

  const handleDelete = useCallback(
    (name: string) => {
      const count = conversations.filter((c) =>
        (c.extra as { tags?: string[] } | undefined)?.tags?.includes(name)
      ).length;
      Modal.confirm({
        title: t('conversation.history.tagDeleteConfirmTitle', { name }),
        content: t('conversation.history.tagDeleteConfirmContent', { count }),
        okText: t('conversation.history.tagDeleteConfirmOk'),
        cancelText: t('common.cancel'),
        okButtonProps: { status: 'warning' },
        onOk: async () => {
          setBusyTag(name);
          try {
            const success = await deleteTagEverywhere(name);
            if (success) {
              await removeColor(name);
            } else {
              Message.error(t('conversation.history.tagDeleteFailed'));
            }
          } finally {
            setBusyTag(null);
          }
        },
        style: { borderRadius: '12px' },
        alignCenter: true,
        getPopupContainer: () => document.body,
      });
    },
    [conversations, deleteTagEverywhere, removeColor, t]
  );

  return (
    <Modal
      title={
        isAssignMode ? t('conversation.history.tagModalTitleAssign') : t('conversation.history.tagModalTitleManage')
      }
      visible={visible}
      onCancel={onClose}
      footer={null}
      style={{ width: 360, borderRadius: '12px' }}
      alignCenter
      getPopupContainer={() => document.body}
    >
      <div className='flex flex-col gap-12px'>
        {allTags.length === 0 && <div className='text-13px text-t-tertiary'>{t('conversation.history.tagNone')}</div>}

        <div className='flex flex-col gap-8px max-h-320px overflow-y-auto'>
          {allTags.map((name) =>
            isAssignMode ? (
              <TagChip
                key={name}
                name={name}
                color={getColor(name)}
                checkable
                checked={assignedTags.has(name)}
                onCheckedChange={(checked) => void handleToggleAssigned(name, checked)}
              />
            ) : (
              <div key={name} className='flex items-center gap-8px'>
                <span
                  role='button'
                  aria-label={t('conversation.history.tagFilterButton')}
                  className='size-16px rd-full flex-shrink-0 cursor-pointer border border-solid border-border-2'
                  style={{ backgroundColor: `rgb(var(--${getColor(name)}-6))` }}
                  onClick={() => void handleRecolor(name)}
                />
                {editingTag === name ? (
                  <Input
                    autoFocus
                    size='small'
                    value={editingName}
                    onChange={setEditingName}
                    onPressEnter={() => void commitRename()}
                    onBlur={() => void commitRename()}
                    placeholder={t('conversation.history.tagRenamePlaceholder')}
                  />
                ) : (
                  <span
                    className='flex-1 text-14px text-t-primary cursor-text truncate'
                    onClick={() => startRename(name)}
                  >
                    {name}
                  </span>
                )}
                <Button
                  size='mini'
                  type='text'
                  status='warning'
                  loading={busyTag === name}
                  icon={<Close theme='outline' size='14' />}
                  onClick={() => handleDelete(name)}
                />
              </div>
            )
          )}
        </div>

        <div className='flex gap-8px'>
          <Input
            value={newTagName}
            onChange={setNewTagName}
            onPressEnter={() => void handleAddNewTag()}
            placeholder={t('conversation.history.tagNewPlaceholder')}
            allowClear
          />
          <Button
            type='primary'
            loading={adding}
            icon={<Plus theme='outline' size='14' />}
            onClick={() => void handleAddNewTag()}
          >
            {t('conversation.history.tagAdd')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default TagManageModal;
