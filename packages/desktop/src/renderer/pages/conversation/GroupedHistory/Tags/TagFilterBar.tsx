/**
 * @license
 * Copyright 2026 DCode (dcodes.site)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Dropdown, Menu } from '@arco-design/web-react';
import { TagOne } from '@icon-park/react';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import TagChip from './TagChip';

type TagFilterBarProps = {
  availableTags: string[];
  getColor: (name: string) => string;
  selectedTags: Set<string>;
  onToggleTag: (name: string) => void;
  onClear: () => void;
  onManage: () => void;
};

const TagFilterBar: React.FC<TagFilterBarProps> = ({
  availableTags,
  getColor,
  selectedTags,
  onToggleTag,
  onClear,
  onManage,
}) => {
  const { t } = useTranslation();

  if (availableTags.length === 0) {
    return null;
  }

  const droplist = (
    <Menu className='!p-8px' style={{ width: 220 }}>
      <div className='flex flex-col gap-6px mb-8px'>
        {availableTags.map((name) => (
          <TagChip
            key={name}
            name={name}
            color={getColor(name)}
            checkable
            checked={selectedTags.has(name)}
            onCheckedChange={() => onToggleTag(name)}
          />
        ))}
      </div>
      <Menu.Item key='clear' disabled={selectedTags.size === 0} onClick={onClear}>
        {t('conversation.history.tagClearFilter')}
      </Menu.Item>
      <Menu.Item key='manage' onClick={onManage}>
        {t('conversation.history.tagModalTitleManage')}
      </Menu.Item>
    </Menu>
  );

  return (
    <div className='px-12px pt-8px'>
      <Dropdown droplist={droplist} trigger='click' position='bl' getPopupContainer={() => document.body}>
        <span
          className={classNames(
            'inline-flex items-center gap-6px h-26px px-8px rd-6px cursor-pointer text-12px transition-colors',
            selectedTags.size > 0 ? 'bg-fill-2 text-t-primary' : 'text-t-secondary hover:bg-fill-1'
          )}
        >
          <TagOne theme='outline' size='14' />
          <span>{t('conversation.history.tagFilterButton')}</span>
          {selectedTags.size > 0 && (
            <span className='min-w-16px h-16px px-4px rd-full bg-[rgb(var(--primary-6))] text-white text-11px leading-16px text-center'>
              {selectedTags.size}
            </span>
          )}
        </span>
      </Dropdown>
    </div>
  );
};

export default TagFilterBar;
