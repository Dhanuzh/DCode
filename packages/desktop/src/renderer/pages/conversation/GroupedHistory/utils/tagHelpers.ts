/**
 * @license
 * Copyright 2026 DCode (dcodes.site)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import type { GroupedHistoryResult, TimelineSection } from '../types';

export const TAG_COLOR_PALETTE = [
  'arcoblue',
  'green',
  'orange',
  'red',
  'purple',
  'cyan',
  'pinkpurple',
  'gray',
] as const;
export type TagColor = (typeof TAG_COLOR_PALETTE)[number];

export function getConversationTags(conversation: TChatConversation): string[] {
  const tags = (conversation.extra as { tags?: string[] } | undefined)?.tags;
  return Array.isArray(tags) ? tags : [];
}

export function deriveTagSet(conversations: TChatConversation[]): string[] {
  const set = new Set<string>();
  for (const conversation of conversations) {
    for (const tag of getConversationTags(conversation)) {
      set.add(tag);
    }
  }
  return [...set].toSorted((a, b) => a.localeCompare(b));
}

export function pickNextTagColor(usedCount: number): TagColor {
  const index = ((usedCount % TAG_COLOR_PALETTE.length) + TAG_COLOR_PALETTE.length) % TAG_COLOR_PALETTE.length;
  return TAG_COLOR_PALETTE[index];
}

export function filterConversationsByTags(
  conversations: TChatConversation[],
  selectedTags: Set<string>
): TChatConversation[] {
  if (selectedTags.size === 0) {
    return conversations;
  }
  return conversations.filter((conversation) => getConversationTags(conversation).some((tag) => selectedTags.has(tag)));
}

export function filterGroupedHistoryByTags(
  result: GroupedHistoryResult,
  selectedTags: Set<string>
): GroupedHistoryResult {
  if (selectedTags.size === 0) {
    return result;
  }

  const matches = (conversation: TChatConversation) =>
    getConversationTags(conversation).some((tag) => selectedTags.has(tag));

  const pinnedConversations = result.pinnedConversations.filter(matches);

  const timelineSections: TimelineSection[] = result.timelineSections
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => {
          if (item.type === 'conversation') {
            return item.conversation && matches(item.conversation) ? item : null;
          }
          if (item.type === 'workspace' && item.workspaceGroup) {
            const filteredConversations = item.workspaceGroup.conversations.filter(matches);
            if (filteredConversations.length === 0) {
              return null;
            }
            return {
              ...item,
              workspaceGroup: { ...item.workspaceGroup, conversations: filteredConversations },
            };
          }
          return null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    }))
    .filter((section) => section.items.length > 0);

  return { pinnedConversations, timelineSections };
}

export type TagUpdatePlanEntry = { id: string; tags: string[] };

export function planTagRename(conversations: TChatConversation[], from: string, to: string): TagUpdatePlanEntry[] {
  const plan: TagUpdatePlanEntry[] = [];
  for (const conversation of conversations) {
    const tags = getConversationTags(conversation);
    if (!tags.includes(from)) {
      continue;
    }
    const next = tags.filter((tag) => tag !== from);
    if (!next.includes(to)) {
      next.push(to);
    }
    plan.push({ id: conversation.id, tags: next });
  }
  return plan;
}

export function planTagRemoval(conversations: TChatConversation[], tagName: string): TagUpdatePlanEntry[] {
  const plan: TagUpdatePlanEntry[] = [];
  for (const conversation of conversations) {
    const tags = getConversationTags(conversation);
    if (!tags.includes(tagName)) {
      continue;
    }
    plan.push({ id: conversation.id, tags: tags.filter((tag) => tag !== tagName) });
  }
  return plan;
}
