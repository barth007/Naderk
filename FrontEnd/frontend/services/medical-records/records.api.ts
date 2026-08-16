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
  },

  // The PDF endpoint requires JWT auth, so a plain <a href> download 401s (the
  // browser sends no Authorization header). Fetch it through the authenticated
  // client as a blob and trigger the download client-side.
  downloadPrescriptionPdf: async (id: string) => {
    const response = await apiClient.get(
      `/medical-records/prescriptions/${id}/pdf/`,
      { responseType: 'blob' },
    );
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prescription-${id.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};
