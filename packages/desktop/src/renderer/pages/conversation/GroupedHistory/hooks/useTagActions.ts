/**
 * @license
 * Copyright 2026 DCode (dcodes.site)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { emitter } from '@/renderer/utils/emitter';
import { useCallback } from 'react';
import { planTagRemoval, planTagRename, type TagUpdatePlanEntry } from '../utils/tagHelpers';

async function applyTagPlan(plan: TagUpdatePlanEntry[]): Promise<boolean> {
  if (plan.length === 0) {
    return true;
  }
  const results = await Promise.all(
    plan.map(({ id, tags }) =>
      ipcBridge.conversation.update.invoke({
        id,
        updates: { extra: { tags } as Partial<TChatConversation['extra']> } as Partial<TChatConversation>,
        merge_extra: true,
      })
    )
  );
  emitter.emit('chat.history.refresh');
  return results.every(Boolean);
}

export const useTagActions = (conversations: TChatConversation[]) => {
  const setConversationTags = useCallback(async (id: string, tags: string[]): Promise<boolean> => {
    const success = await ipcBridge.conversation.update.invoke({
      id,
      updates: { extra: { tags } as Partial<TChatConversation['extra']> } as Partial<TChatConversation>,
      merge_extra: true,
    });
    if (success) {
      emitter.emit('chat.history.refresh');
    }
    return success;
  }, []);

  const renameTagEverywhere = useCallback(
    async (from: string, to: string): Promise<boolean> => applyTagPlan(planTagRename(conversations, from, to)),
    [conversations]
  );

  const deleteTagEverywhere = useCallback(
    async (tagName: string): Promise<boolean> => applyTagPlan(planTagRemoval(conversations, tagName)),
    [conversations]
  );

  return { setConversationTags, renameTagEverywhere, deleteTagEverywhere };
};
