/** Serializable doctor share payload — facts only (N1). */

export interface DoctorShareSosEvent {
  triggeredAt: string;
  status: "open" | "resolved";
  resolvedAt: string | null;
  resolvedByRole: string | null;
  resolvedChannel: string | null;
  /** Minutes; null if still open */
  responseMinutes: number | null;
}

export interface DoctorShareCheckIn {
  scheduledAt: string;
  domain: string;
  status: string;
  responseValue: string | null;
  respondedAt: string | null;
}

export interface DoctorShareMedication {
  name: string;
  dosage: string;
  dosageUnit: string;
  times: string[];
  enabled: boolean;
}

export interface DoctorShareSummary {
  linkId: string;
  viewerTimeZone: string;
  elder: {
    firstName: string;
    surname: string;
    timeZone: string;
    address: string;
  };
  medications: DoctorShareMedication[];
  checkIns: DoctorShareCheckIn[];
  sosEvents: DoctorShareSosEvent[];
}
