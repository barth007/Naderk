// components/auth/PermissionGuard.tsx
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface PermissionGuardProps {
  permissions: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAll?: boolean;
}

export function PermissionGuard({ 
  permissions, 
  children, 
  fallback, 
  requireAll = false 
}: PermissionGuardProps) {
  const { user } = useAuth();

  // Super admin always has bypass access
  if (user?.role === 'SUPER_ADMIN') {
    return <>{children}</>;
  }

  const userPermissions = user?.permissions || [];

  const hasAccess = requireAll
    ? permissions.every(p => userPermissions.includes(p))
    : permissions.some(p => userPermissions.includes(p));

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="w-full max-w-md mx-auto p-4 py-12 text-center animate-in fade-in duration-300">
        <Card className="p-8 border border-red-100 bg-red-50/10 rounded-3xl flex flex-col items-center shadow-sm">
          <div className="w-12 h-12 bg-red-100/50 rounded-full flex items-center justify-center mb-4 text-red-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 text-base mb-1.5">Access Restricted</h3>
          <p className="text-gray-500 text-xs leading-relaxed max-w-xs">
            You do not have the required permissions to view this section. If you believe this is an error, please contact your administrator.
          </p>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export default PermissionGuard;
