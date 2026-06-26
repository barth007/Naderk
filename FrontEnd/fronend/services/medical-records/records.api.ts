import { apiClient } from '@/lib/api';
import { 
  PatientRecord, 
  MedicalRecordsOverview, 
  ConsultationEncounter, 
  ConsultationEncounterDetail,
  PaginatedResponse, 
  EyewearPrescription, 
  DiagnosticResult, 
  MedicalScan 
} from './records.types';

export const medicalRecordsApi = {
  getPatients: async (search?: string) => {
    const params = search ? { q: search } : {};
    const response = await apiClient.get('/medical-records/patients/', { params });
    return response.data.data as PatientRecord[];
  },

  getOverview: async (patientId?: string) => {
    const params = patientId ? { patient_id: patientId } : {};
    const response = await apiClient.get('/medical-records/overview/', { params });
    return response.data.data as MedicalRecordsOverview;
  },

  getEncounters: async (params: { patient_id?: string; search?: string; page?: number }) => {
    const response = await apiClient.get('/medical-records/encounters/', { params });
    return response.data.data as PaginatedResponse<ConsultationEncounter>;
  },

  getEncounterDetail: async (id: string) => {
    const response = await apiClient.get(`/medical-records/encounters/${id}/`);
    return response.data.data as ConsultationEncounterDetail;
  },

  getPrescriptions: async (params: { patient_id?: string; page?: number }) => {
    const response = await apiClient.get('/medical-records/prescriptions/', { params });
    return response.data.data as PaginatedResponse<EyewearPrescription>;
  },

  getDiagnostics: async (params: { patient_id?: string; page?: number }) => {
    const response = await apiClient.get('/medical-records/diagnostics/', { params });
    return response.data.data as PaginatedResponse<DiagnosticResult>;
  },

  getScans: async (params: { patient_id?: string; page?: number }) => {
    const response = await apiClient.get('/medical-records/scans/', { params });
    return response.data.data as PaginatedResponse<MedicalScan>;
  },

  getPrescriptionPdfUrl: (id: string) => {
    const baseURL = apiClient.defaults.baseURL || 'http://127.0.0.1:8000/api/v1';
    return `${baseURL}/medical-records/prescriptions/${id}/pdf/`;
  }
};
