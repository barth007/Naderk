import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { medicalRecordsApi } from './records.api';

// ─── Medication Types ────────────────────────────────────────────────────────
export interface Medication {
  id: string;
  patient: string;
  encounter: string | null;
  prescribed_by: string;
  prescribed_by_name: string;
  name: string;
  dosage: string;
  frequency: string;
  status: 'ACTIVE' | 'COMPLETED';
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export interface MedicationCreatePayload {
  patient_id: string;
  encounter_id?: string | null;
  name: string;
  dosage: string;
  frequency: string;
  start_date: string;
  end_date?: string | null;
}

// ─── Medication Hooks ─────────────────────────────────────────────────────────
export const useMedications = (params: { patient_id?: string; encounter_id?: string } = {}) => {
  return useQuery({
    queryKey: ['medications', params],
    queryFn: async () => {
      const qp = new URLSearchParams();
      if (params.patient_id) qp.set('patient_id', params.patient_id);
      if (params.encounter_id) qp.set('encounter_id', params.encounter_id);
      const res = await apiClient.get(`/medical-records/medications/?${qp}`);
      return res.data.data as Medication[];
    },
  });
};

export const useCreateMedication = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: MedicationCreatePayload) => {
      const res = await apiClient.post('/medical-records/medications/', payload);
      return res.data.data as Medication;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] });
      qc.invalidateQueries({ queryKey: ['medical-records-overview'] });
    },
  });
};

export const useDeleteMedication = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/medical-records/medications/${id}/`);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medications'] }),
  });
};

// ─── Existing hooks ───────────────────────────────────────────────────────────
export const usePatientRecords = (search?: string) => {
  return useQuery({
    queryKey: ['patient-records', search],
    queryFn: () => medicalRecordsApi.getPatients(search)
  });
};

export const useMedicalRecordsOverview = (patientId?: string) => {
  return useQuery({
    queryKey: ['medical-records-overview', patientId],
    queryFn: () => medicalRecordsApi.getOverview(patientId)
  });
};

export const useMedicalEncounters = (params: { patient_id?: string; search?: string; page?: number }) => {
  return useQuery({
    queryKey: ['medical-encounters', params],
    queryFn: () => medicalRecordsApi.getEncounters(params)
  });
};

export const useMedicalEncounterDetail = (id: string) => {
  return useQuery({
    queryKey: ['medical-encounter-detail', id],
    queryFn: () => medicalRecordsApi.getEncounterDetail(id),
    enabled: !!id
  });
};

export const useMedicalPrescriptions = (params: { patient_id?: string; page?: number }) => {
  return useQuery({
    queryKey: ['medical-prescriptions', params],
    queryFn: () => medicalRecordsApi.getPrescriptions(params)
  });
};

export const useMedicalDiagnostics = (params: { patient_id?: string; page?: number }) => {
  return useQuery({
    queryKey: ['medical-diagnostics', params],
    queryFn: () => medicalRecordsApi.getDiagnostics(params)
  });
};

export const useMedicalScans = (params: { patient_id?: string; page?: number }) => {
  return useQuery({
    queryKey: ['medical-scans', params],
    queryFn: () => medicalRecordsApi.getScans(params)
  });
};
