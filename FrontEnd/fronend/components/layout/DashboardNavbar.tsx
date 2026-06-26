"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bell, LogOut, Settings, Loader2, Check, ShoppingCart, Search, Package } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { 
  useNotifications, 
  useMarkNotificationRead, 
  useMarkAllNotificationsRead 
} from '@/services/notifications/notifications.hooks';
import { format, parseISO } from 'date-fns';
import { useCart } from '@/services/marketplace/marketplace.hooks';

export default function DashboardNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Fetch active notifications only when authenticated
  const { data: notifData } = useNotifications(!!isAuthenticated);
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const { data: cartData } = useCart();
  const searchParams = useSearchParams();
  const [searchVal, setSearchVal] = useState('');

  useEffect(() => {
    setSearchVal(searchParams.get('q') || '');
  }, [searchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    if (searchVal.trim()) {
      params.set('q', searchVal.trim());
    } else {
      params.delete('q');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`;
    }
    return user?.email?.[0].toUpperCase() || "U";
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleNotificationClick = (notif: any) => {
    markReadMutation.mutate(notif.id);
    setIsNotifOpen(false);
    if (notif.conversation) {
      router.push('/dashboard/messages');
    }
  };

  const getFormattedTime = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      const isToday = new Date().toDateString() === date.toDateString();
      return format(date, isToday ? 'h:mm a' : 'MMM d');
    } catch {
      return '';
    }
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifData?.unread_count || 0;
  const notifications = notifData?.results || [];

  return (
    <div className="w-full bg-white flex flex-col sticky top-0 z-50 border-b border-gray-100 shadow-sm">
      {/* Top Header Row */}
      <div className="w-full px-4 md:px-8 flex items-center justify-between h-16 md:h-20">
        {/* Left side: Logo */}
        <Link href="/" className="flex items-center">
            <img src="/naderk_logo.png" alt="Naderk Eye Center" className="h-7 md:h-10 object-contain" />
        </Link>

        {/* Global Search Input (Only for Doctor/Staff) */}
        {user && ['DOCTOR', 'MEDICAL_AGENT', 'AGENT', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) && (
          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-xl mx-8 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search patient's records, appointments..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-full text-xs font-semibold bg-gray-50/50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#E03E3E] focus:border-[#E03E3E]"
            />
          </form>
        )}

        {/* Right side: Actions */}
        <div className="flex items-center gap-6">
            
            {/* Cart Icon (conditionally shown on marketplace or optical config routes) */}
            {(pathname?.includes('/marketplace') || pathname?.includes('/optical-builder')) && (
              <Link 
                href="/dashboard/cart"
                className="text-gray-600 hover:text-[#ff052f] transition-colors p-1.5 rounded-full hover:bg-gray-50 focus:outline-none relative cursor-pointer"
              >
                <ShoppingCart className="w-5 h-5" />
                {((cartData?.items?.reduce((sum, item) => sum + item.quantity, 0)) || 0) > 0 && (
                  <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#ff052f] rounded-full text-white text-[9px] font-bold flex items-center justify-center border-2 border-white shadow">
                    {cartData?.items?.reduce((sum, item) => sum + item.quantity, 0)}
                  </div>
                )}
              </Link>
            )}

            {/* Notification Bell Dropdown */}
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="text-gray-600 hover:text-gray-900 transition-colors p-1.5 rounded-full hover:bg-gray-50 focus:outline-none relative cursor-pointer"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#E03E3E] rounded-full text-white text-[9px] font-bold flex items-center justify-center border-2 border-white shadow">
                    {unreadCount}
                  </div>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 z-50">
                  {/* Dropdown Header */}
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <span className="text-sm font-bold text-gray-900">Notifications</span>
                    {unreadCount > 0 && (
                      <button 
                        onClick={() => markAllReadMutation.mutate()}
                        className="text-[11px] font-bold text-[#E03E3E] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Dropdown List */}
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-gray-400 font-semibold">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <button
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`w-full text-left p-3.5 hover:bg-gray-50 flex gap-3 items-start transition-colors cursor-pointer ${
                            !notif.is_read ? 'bg-red-50/5' : ''
                          }`}
                        >
                          <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                            !notif.is_read ? 'bg-[#E03E3E]' : 'bg-transparent'
                          }`} />
                          <div className="flex-grow min-w-0">
                            <p className="text-xs font-bold text-gray-900 leading-snug">{notif.title}</p>
                            <p className="text-[11px] text-gray-400 truncate mt-0.5">{notif.message}</p>
                            <span className="text-[9px] text-gray-400 font-medium mt-1.5 block">
                              {getFormattedTime(notif.created_at)}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="p-2 border-t border-gray-100 text-center bg-gray-50/50">
                    <Link 
                      href="/dashboard/messages" 
                      onClick={() => setIsNotifOpen(false)}
                      className="text-[11px] font-bold text-gray-500 hover:text-gray-900"
                    >
                      View All Messages
                    </Link>
                  </div>
                </div>
              )}
            </div>
            
            {/* Avatar Dropdown */}
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-50 text-gray-700 font-bold flex items-center justify-center border-2 border-white shadow-sm cursor-pointer hover:bg-gray-100 transition-colors overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#E03E3E] focus:ring-offset-2 text-xs md:text-base shrink-0"
                >
                    {user?.profile_picture ? (
                        <img src={user.profile_picture} alt="Avatar" className="w-full h-full object-cover" />
                    ) : getInitials()}
                </button>

                {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2">
                        <div className="px-4 py-2 border-b border-gray-100 mb-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">{user?.first_name} {user?.last_name}</p>
                            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                        </div>
                        <Link
                            href="/dashboard/orders"
                            onClick={() => setIsDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <Package className="w-4 h-4" /> Orders
                        </Link>
                        <Link
                            href="/profile"
                            onClick={() => setIsDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <Settings className="w-4 h-4" /> Settings
                        </Link>
                        <div className="h-px bg-gray-100 my-1" />
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#E03E3E] hover:bg-[#fcdede] transition-colors"
                        >
                            <LogOut className="w-4 h-4" /> Logout
                        </button>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
