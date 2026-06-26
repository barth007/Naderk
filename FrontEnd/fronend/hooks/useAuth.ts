import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    setAuth: (user: User, access: string, refresh: string) => void;
    setTokens: (access: string, refresh: string) => void;
    setUser: (user: User) => void;
    logout: () => void;
}

export const useAuth = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            
            setAuth: (user, access, refresh) => set({
                user,
                accessToken: access,
                refreshToken: refresh,
                isAuthenticated: true
            }),
            
            setTokens: (access, refresh) => set({
                accessToken: access,
                refreshToken: refresh,
            }),
            
            setUser: (user) => set({ user }),
            
            logout: () => set({
                user: null,
                accessToken: null,
                refreshToken: null,
                isAuthenticated: false
            }),
        }),
        {
            name: 'naderkeye-auth-storage',
        }
    )
);
