/**
 * @license
 * Copyright 2026 DCode (dcodes.site)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { TChatConversation } from '@/common/config/storage';
import type { GroupedHistoryResult } from '@/renderer/pages/conversation/GroupedHistory/types';
import {
  deriveTagSet,
  filterConversationsByTags,
  filterGroupedHistoryByTags,
  getConversationTags,
  pickNextTagColor,
  planTagRemoval,
  planTagRename,
  TAG_COLOR_PALETTE,
} from '@/renderer/pages/conversation/GroupedHistory/utils/tagHelpers';

const baseModel = {
  id: 'prov-1',
  platform: 'anthropic',
  name: 'Anthropic',
  base_url: 'https://api.anthropic.com',
  api_key: '',
  use_model: 'claude-sonnet',
};

function makeConversation(id: string, tags: string[] | undefined, workspace = '/ws'): TChatConversation {
  return {
    created_at: 1000,
    modified_at: 1000,
    name: `Conversation ${id}`,
    id,
    type: 'aionrs',
    model: baseModel,
    extra: {
      workspace,
      ...(tags !== undefined ? { tags } : {}),
    },
  } as TChatConversation;
}

describe('getConversationTags', () => {
  it('returns the tags array when present', () => {
    expect(getConversationTags(makeConversation('a', ['work', 'urgent']))).toEqual(['work', 'urgent']);
  });

  it('returns an empty array when tags is absent', () => {
    expect(getConversationTags(makeConversation('a', undefined))).toEqual([]);
  });
});

describe('deriveTagSet', () => {
  it('dedupes and sorts tags across conversations', () => {
    const conversations = [
      makeConversation('a', ['work', 'urgent']),
      makeConversation('b', ['urgent', 'personal']),
      makeConversation('c', undefined),
    ];
    expect(deriveTagSet(conversations)).toEqual(['personal', 'urgent', 'work']);
  });

  it('returns an empty array when no conversation has tags', () => {
    expect(deriveTagSet([makeConversation('a', undefined), makeConversation('b', [])])).toEqual([]);
  });
});

describe('pickNextTagColor', () => {
  it('cycles through all palette entries in order', () => {
    for (let i = 0; i < TAG_COLOR_PALETTE.length; i++) {
      expect(pickNextTagColor(i)).toBe(TAG_COLOR_PALETTE[i]);
    }
  });

  it('wraps around after the last palette entry', () => {
    expect(pickNextTagColor(TAG_COLOR_PALETTE.length)).toBe(TAG_COLOR_PALETTE[0]);
    expect(pickNextTagColor(TAG_COLOR_PALETTE.length + 1)).toBe(TAG_COLOR_PALETTE[1]);
  });
});

describe('filterConversationsByTags', () => {
  const conversations = [
    makeConversation('a', ['work']),
    makeConversation('b', ['personal']),
    makeConversation('c', ['work', 'urgent']),
    makeConversation('d', undefined),
  ];

  it('passes everything through when the selection is empty', () => {
    expect(filterConversationsByTags(conversations, new Set())).toBe(conversations);
  });

  it('matches with OR semantics across multiple selected tags', () => {
    const result = filterConversationsByTags(conversations, new Set(['personal', 'urgent']));
    expect(result.map((c) => c.id)).toEqual(['b', 'c']);
  });

  it('a conversation with no tags never matches a non-empty selection', () => {
    const result = filterConversationsByTags(conversations, new Set(['work']));
    expect(result.some((c) => c.id === 'd')).toBe(false);
  });
});

describe('filterGroupedHistoryByTags', () => {
  const pinned = makeConversation('pinned-1', ['work']);
  const pinnedNoMatch = makeConversation('pinned-2', ['personal']);
  const workspaceMatch = makeConversation('ws-match', ['work'], '/proj');
  const workspaceNoMatch = makeConversation('ws-no-match', ['personal'], '/proj');
  const flatMatch = makeConversation('flat-match', ['work']);
  const flatNoMatch = makeConversation('flat-no-match', ['personal']);

  const result: GroupedHistoryResult = {
    pinnedConversations: [pinned, pinnedNoMatch],
    timelineSections: [
      {
        timeline: 'today',
        items: [
          {
            type: 'workspace',
            time: 1,
            workspaceGroup: {
              workspace: '/proj',
              display_name: 'proj',
              conversations: [workspaceMatch, workspaceNoMatch],
            },
          },
          { type: 'conversation', time: 2, conversation: flatMatch },
          { type: 'conversation', time: 3, conversation: flatNoMatch },
        ],
      },
    ],
  };

  it('passes the result through unchanged when the selection is empty', () => {
    expect(filterGroupedHistoryByTags(result, new Set())).toBe(result);
  });

  it('filters pinned conversations', () => {
    const filtered = filterGroupedHistoryByTags(result, new Set(['work']));
    expect(filtered.pinnedConversations.map((c) => c.id)).toEqual(['pinned-1']);
  });

  it('filters conversations inside a workspace group while preserving matching siblings', () => {
    const filtered = filterGroupedHistoryByTags(result, new Set(['work']));
    const workspaceItem = filtered.timelineSections[0]?.items.find((item) => item.type === 'workspace');
    expect(workspaceItem?.workspaceGroup?.conversations.map((c) => c.id)).toEqual(['ws-match']);
  });

  it('keeps only matching flat conversation items', () => {
    const filtered = filterGroupedHistoryByTags(result, new Set(['work']));
    const flatItems = filtered.timelineSections[0]?.items.filter((item) => item.type === 'conversation');
    expect(flatItems?.map((item) => item.conversation?.id)).toEqual(['flat-match']);
  });

  it('drops a workspace group entirely when none of its conversations match', () => {
    const filtered = filterGroupedHistoryByTags(result, new Set(['nonexistent']));
    expect(filtered.timelineSections).toEqual([]);
  });

  it('drops a whole section when it becomes empty', () => {
    const onlyNoMatchResult: GroupedHistoryResult = {
      pinnedConversations: [],
      timelineSections: [{ timeline: 'today', items: [{ type: 'conversation', time: 1, conversation: flatNoMatch }] }],
    };
    const filtered = filterGroupedHistoryByTags(onlyNoMatchResult, new Set(['work']));
    expect(filtered.timelineSections).toEqual([]);
  });
});

describe('planTagRename', () => {
  const conversations = [
    makeConversation('a', ['work']),
    makeConversation('b', ['personal']),
    makeConversation('c', ['work', 'urgent']),
  ];

  it('only returns entries for conversations that had the old tag', () => {
    const plan = planTagRename(conversations, 'work', 'projects');
    expect(plan.map((entry) => entry.id)).toEqual(['a', 'c']);
  });

  it('renames the tag in place, preserving other tags', () => {
    const plan = planTagRename(conversations, 'work', 'projects');
    expect(plan.find((entry) => entry.id === 'a')?.tags).toEqual(['projects']);
    expect(plan.find((entry) => entry.id === 'c')?.tags).toEqual(['urgent', 'projects']);
  });

  it('de-dupes when the rename target collides with an existing tag on that conversation', () => {
    const collision = [makeConversation('a', ['work', 'projects'])];
    const plan = planTagRename(collision, 'work', 'projects');
    expect(plan[0]?.tags).toEqual(['projects']);
  });

  it('returns an empty plan when no conversation has the tag', () => {
    expect(planTagRename(conversations, 'nonexistent', 'x')).toEqual([]);
  });
});

describe('planTagRemoval', () => {
  const conversations = [
    makeConversation('a', ['work']),
    makeConversation('b', ['personal']),
    makeConversation('c', ['work', 'urgent']),
  ];

  it('only returns entries for conversations that had the tag', () => {
    const plan = planTagRemoval(conversations, 'work');
    expect(plan.map((entry) => entry.id)).toEqual(['a', 'c']);
  });

  it('removes the tag while preserving the order of remaining tags', () => {
    const plan = planTagRemoval(conversations, 'work');
    expect(plan.find((entry) => entry.id === 'c')?.tags).toEqual(['urgent']);
  });

  it('returns an empty plan when no conversation has the tag', () => {
    expect(planTagRemoval(conversations, 'nonexistent')).toEqual([]);
  });
});
