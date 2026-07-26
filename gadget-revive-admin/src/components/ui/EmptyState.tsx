'use client';

import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?:
    | React.ReactNode
    | {
        label: string;
        onClick: () => void;
      };
}

const isActionConfig = (
  action: EmptyStateProps['action'],
): action is { label: string; onClick: () => void } =>
  typeof action === 'object' &&
  action !== null &&
  !React.isValidElement(action) &&
  'label' in action &&
  'onClick' in action;

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        {icon || <Inbox className="w-8 h-8 text-gray-400" />}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 text-center max-w-sm mb-4">{description}</p>
      )}
      {action &&
        (isActionConfig(action) ? (
          <Button onClick={action.onClick}>{action.label}</Button>
        ) : (
          action
        ))}
    </div>
  );
};

export default EmptyState;
