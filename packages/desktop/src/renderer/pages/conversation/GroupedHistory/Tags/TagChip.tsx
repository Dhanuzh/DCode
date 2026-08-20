/**
 * @license
 * Copyright 2026 DCode (dcodes.site)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tag } from '@arco-design/web-react';
import classNames from 'classnames';
import React from 'react';

type TagChipProps = {
  name: string;
  color: string;
  size?: 'small' | 'medium';
  checkable?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  closable?: boolean;
  onClose?: () => void;
  className?: string;
};

const TagChip: React.FC<TagChipProps> = ({
  name,
  color,
  size = 'small',
  checkable = false,
  checked = false,
  onCheckedChange,
  closable = false,
  onClose,
  className,
}) => (
  <Tag
    size={size}
    bordered
    color={color}
    checkable={checkable}
    checked={checked}
    onCheck={onCheckedChange}
    closable={closable}
    onClose={onClose}
    className={classNames('!rounded-full !font-medium', className)}
  >
    {name}
  </Tag>
);

export default TagChip;
