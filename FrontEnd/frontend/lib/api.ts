import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';

export const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * Auth endpoints that are `AllowAny` on the backend and must never carry a
 * Bearer token or trigger a refresh-on-401.
 *
 * This used to be a blanket `url.includes('/auth/')` test, which also stripped
 * the token from `/auth/me/` and `/auth/change-password/` — both `IsAuthenticated`.
 * Every dashboard mount therefore 401'd, refreshed, and retried: three round
 * trips instead of one, and (with ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION)
 * a needless token rotation each time.
 */
const PUBLIC_AUTH_PATHS = [
    '/auth/register/',
    '/auth/login/',
    '/auth/verify-otp/',
    '/auth/resend-otp/',
    '/auth/forgot-password/',
    '/auth/reset-password/',
    '/auth/refresh/',
];

function isPublicAuthRoute(url?: string): boolean {
    if (!url) return false;
    return PUBLIC_AUTH_PATHS.some((path) => url.includes(path));
}

// Request Interceptor to attach token
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const { accessToken } = useAuth.getState();
        if (accessToken && !isPublicAuthRoute(config.url)) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

/**
 * Single-flight refresh.
 *
 * The backend rotates and blacklists the refresh token on every use. Without
 * this guard, two requests 401-ing concurrently fire two `/auth/refresh/` calls
 * with the same token — the second one presents a freshly blacklisted token,
 * fails, and logs the user out mid-session.
 */
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        const { refreshToken, setTokens } = useAuth.getState();
        if (!refreshToken) throw new Error('No refresh token available');

        const res = await axios.post(`${apiClient.defaults.baseURL}/auth/refresh/`, {
            refresh: refreshToken,
        });

        const newAccess = res.data.access;
        // Some APIs return a new refresh token; SimpleJWT does when rotating.
        const newRefresh = res.data.refresh || refreshToken;
        setTokens(newAccess, newRefresh);
        return newAccess;
    })();

    // Clear the slot once settled so the next genuine 401 can refresh again.
    refreshPromise.catch(() => {}).finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
}

function forceLogout() {
    useAuth.getState().logout();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
    }
}

// Response Interceptor for Token Refresh and Global Error Handling
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle Token Refresh on 401
        if (
            error.response?.status === 401 &&
            originalRequest &&
            !originalRequest._retry &&
            !isPublicAuthRoute(originalRequest.url)
        ) {
            originalRequest._retry = true;

            try {
                const newAccess = await refreshAccessToken();

                // Retry original request
                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${newAccess}`;
                }
                return apiClient(originalRequest);
            } catch (refreshError) {
                // Refresh failed — the session is genuinely dead.
                forceLogout();
                return Promise.reject(refreshError);
            }
        }

        // Global Error Toasts for generic issues
        if (error.response?.status === 500) {
            toast.error("Internal Server Error", { description: "An unexpected error occurred. Please try again later."});
        } else if (!error.response) {
            toast.error("Network Error", { description: "Please check your internet connection."});
        }

        return Promise.reject(error);
    }
);
