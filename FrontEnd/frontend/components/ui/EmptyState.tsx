// components/ui/EmptyState.tsx
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EMPTY_STATE_CONFIG, EmptyStateRole } from '@/utils/empty-state-config';

interface EmptyStateProps {
  role: EmptyStateRole;
  configKey: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ role, configKey, actionLabel, onAction, className = '' }: EmptyStateProps) {
  const roleConfig = EMPTY_STATE_CONFIG[role];
  const itemConfig = roleConfig ? roleConfig[configKey] : null;

  if (!itemConfig) {
    return (
      <Card className={`p-8 text-center flex flex-col items-center justify-center border border-gray-100 rounded-3xl min-h-[200px] ${className}`}>
        <p className="text-gray-400 text-sm font-semibold">Content not found</p>
      </Card>
    );
  }

  const { title, description, iconName } = itemConfig;
  
  // Dynamically resolve the Lucide Icon
  const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;

  return (
    <Card className={`p-6 text-center flex flex-col items-center justify-center border border-gray-100 bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] min-h-[220px] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.03)] ${className}`}>
      <div className="w-12 h-12 bg-[#FEF6F6] rounded-full flex items-center justify-center mb-4 text-[#E03E3E] transition-transform hover:scale-105 duration-300">
        <IconComponent className="w-5 h-5" />
      </div>
      <h3 className="font-bold text-gray-900 text-sm md:text-base mb-1.5">{title}</h3>
      <p className="text-gray-500 text-xs mt-0.5 max-w-sm leading-relaxed px-4">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button 
          onClick={onAction} 
          variant="default" 
          className="mt-4 h-9 px-6 text-xs font-semibold rounded-lg bg-[#E03E3E] hover:bg-red-700 text-white transition-all shadow-sm"
        >
          {actionLabel}
        </Button>
      )}
    </Card>
  );
}

export default EmptyState;
