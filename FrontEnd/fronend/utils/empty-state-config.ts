// utils/empty-state-config.ts
export interface EmptyStateDetail {
  title: string;
  description: string;
  iconName: string;
}

export type EmptyStateRole = 'DOCTOR' | 'PATIENT' | 'OPTICIAN' | 'MEDICAL_AGENT';

export const EMPTY_STATE_CONFIG: Record<EmptyStateRole, Record<string, EmptyStateDetail>> = {
  DOCTOR: {
    NO_APPOINTMENTS: {
      title: "No appointments scheduled today",
      description: "You have a clear schedule today. Take some time to review patient records or catch up on clinical notes.",
      iconName: "Calendar"
    },
    NO_REQUESTS: {
      title: "No pending appointment requests",
      description: "All booking requests have been processed. New patient inquiries will appear here as they arrive.",
      iconName: "Inbox"
    },
    NO_PATIENTS: {
      title: "No patients waiting in queue",
      description: "There are currently no patients checked in or waiting for their consultations today.",
      iconName: "Clock"
    },
    NO_TELEHEALTH: {
      title: "No telehealth sessions scheduled",
      description: "No online video consultations are scheduled for today. Physical visits will remain in your main queue.",
      iconName: "Video"
    },
    NO_RECORDS: {
      title: "No Medical Records",
      description: "This patient has no registered medical records.",
      iconName: "FolderHeart"
    },
    NO_ENCOUNTERS: {
      title: "No consultations",
      description: "No consultation history has been recorded for this patient.",
      iconName: "FileText"
    },
    NO_MEDICATIONS: {
      title: "No active medications",
      description: "This patient has no active prescribed medications.",
      iconName: "Pills"
    },
    NO_DIAGNOSTICS: {
      title: "No diagnostics",
      description: "No diagnostic test results are recorded for this patient.",
      iconName: "Clipboard"
    },
    NO_SCANS: {
      title: "No medical scans",
      description: "No eye scans or imaging files have been uploaded for this patient.",
      iconName: "Image"
    },
    NO_PRESCRIPTIONS: {
      title: "No prescriptions",
      description: "No eyewear prescriptions are on file for this patient.",
      iconName: "Eye"
    }
  },
  PATIENT: {
    NO_APPOINTMENTS: {
      title: "No appointments scheduled",
      description: "You don't have any upcoming appointments. Use the button above to schedule your first eye exam.",
      iconName: "Calendar"
    },
    NO_PRESCRIPTIONS: {
      title: "No prescriptions found",
      description: "Your vision records and active prescriptions will appear here after your first comprehensive examination.",
      iconName: "ClipboardCheck"
    },
    NO_RECORDS: {
      title: "No Medical Records Yet",
      description: "You don't have any medical history logged with us. Schedule an appointment to get started.",
      iconName: "FolderHeart"
    },
    NO_ENCOUNTERS: {
      title: "No recent consultations",
      description: "You have no consultation logs or clinical summaries on record.",
      iconName: "FileText"
    },
    NO_MEDICATIONS: {
      title: "No active medications",
      description: "You are not currently prescribed any active medications.",
      iconName: "Pills"
    },
    NO_DIAGNOSTICS: {
      title: "No diagnostic tests",
      description: "No laboratory or diagnostic test results are currently on file.",
      iconName: "Clipboard"
    },
    NO_SCANS: {
      title: "No medical scans",
      description: "No clinical eye scans, imaging, or OCT records are logged.",
      iconName: "Image"
    }
  },
  OPTICIAN: {
    NO_REVIEWS: {
      title: "No prescription reviews pending",
      description: "All submitted prescriptions are reviewed and up to date.",
      iconName: "ClipboardCheck"
    }
  },
  MEDICAL_AGENT: {
    NO_CHATS: {
      title: "No active patient chats",
      description: "You are all caught up! New patient chat requests will appear here.",
      iconName: "Inbox"
    }
  }
};
