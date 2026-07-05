// types/index.ts

export interface User {
    id: string;
    email: string;
    role: 'PATIENT' | 'DOCTOR' | 'OPTICIAN' | 'MEDICAL_AGENT' | 'ADMIN' | 'SUPER_ADMIN' | 'VOLUNTEER' | 'DONOR' | 'AGENT';
    first_name: string;
    last_name: string;
    full_name?: string;
    profile_completion_status: string;
    profile_picture?: string;
    cover_photo?: string;
    specialization?: string;
    permissions?: string[];
    patient_id?: string;
    phone_number?: string;
    dob?: string;
    gender?: string;
}

export interface ApiSuccessResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
}

export interface ProblemDetailsResponse {
    type: string;
    title: string;
    status: number;
    detail: string;
    instance?: string;
    errors?: Record<string, string[]>;
}

export interface AuthTokens {
    access: string;
    refresh: string;
    user: User;
}
