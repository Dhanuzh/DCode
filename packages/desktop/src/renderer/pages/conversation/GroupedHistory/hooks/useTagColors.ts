/**
 * @license
 * Copyright 2026 DCode (dcodes.site)
 * SPDX-License-Identifier: Apache-2.0
 */

import { configService } from '@/common/config/configService';
import { useCallback, useEffect, useState } from 'react';
import { pickNextTagColor, type TagColor } from '../utils/tagHelpers';

const CONFIG_KEY = 'conversation.tagColors' as const;

export const useTagColors = () => {
  const [tagColors, setTagColors] = useState<Record<string, string>>(() => configService.get(CONFIG_KEY) ?? {});

  useEffect(
    () => configService.subscribe(CONFIG_KEY, (value) => setTagColors((value as Record<string, string>) ?? {})),
    []
  );

  const getColor = useCallback((name: string): string => tagColors[name] ?? 'gray', [tagColors]);

  const persist = useCallback(async (next: Record<string, string>) => {
    setTagColors(next);
    await configService.set(CONFIG_KEY, next);
  }, []);

  const createColorFor = useCallback(
    async (name: string): Promise<string> => {
      if (tagColors[name]) {
        return tagColors[name];
      }
      const color: TagColor = pickNextTagColor(Object.keys(tagColors).length);
      await persist({ ...tagColors, [name]: color });
      return color;
    },
    [persist, tagColors]
  );

  const setColor = useCallback(
    async (name: string, color: string) => {
      await persist({ ...tagColors, [name]: color });
    },
    [persist, tagColors]
  );

  const renameKey = useCallback(
    async (from: string, to: string) => {
      if (from === to) return;
      const next = { ...tagColors };
      const color = next[from];
      delete next[from];
      if (color && !next[to]) {
        next[to] = color;
      }
      await persist(next);
    },
    [persist, tagColors]
  );

  const removeColor = useCallback(
    async (name: string) => {
      if (!(name in tagColors)) return;
      const next = { ...tagColors };
      delete next[name];
      await persist(next);
    },
    [persist, tagColors]
  );

  return { tagColors, getColor, createColorFor, setColor, renameKey, removeColor };
};
