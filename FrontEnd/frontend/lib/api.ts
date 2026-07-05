import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';

export const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor to attach token
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const { accessToken } = useAuth.getState();
        const isAuthRoute = config.url?.includes('/auth/');
        if (accessToken && !isAuthRoute) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor for Token Refresh and Global Error Handling
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        
        // Handle Token Refresh on 401
        if (
            error.response?.status === 401 && 
            !originalRequest._retry &&
            !originalRequest.url?.includes('/auth/login') &&
            !originalRequest.url?.includes('/auth/register')
        ) {
            originalRequest._retry = true;
            
            try {
                const { refreshToken, setTokens, logout } = useAuth.getState();
                if (!refreshToken) {
                    logout();
                    if (typeof window !== 'undefined') window.location.href = '/login';
                    return Promise.reject(error);
                }
                
                // Attempt refresh
                const res = await axios.post(`${apiClient.defaults.baseURL}/auth/refresh/`, {
                    refresh: refreshToken
                });
                
                const newAccess = res.data.access;
                const newRefresh = res.data.refresh || refreshToken; // Some APIs return a new refresh token
                
                setTokens(newAccess, newRefresh);
                
                // Retry original request
                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${newAccess}`;
                }
                return apiClient(originalRequest);
                
            } catch (refreshError) {
                // Refresh failed
                useAuth.getState().logout();
                if (typeof window !== 'undefined') window.location.href = '/login';
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
