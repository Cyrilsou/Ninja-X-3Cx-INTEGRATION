export interface DraftTicketData {
  id: string;
  callId: string;
  title: string;
  description: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  type: 'PROBLEM' | 'REQUEST' | 'INCIDENT' | 'TASK';
  contactInfo?: {
    id?: number;
    phone?: string;
    name?: string;
    email?: string;
  };
  agentInfo: {
    extension: string;
    name?: string;
    ninjaUserId?: number;
  };
  callInfo: {
    duration: number;
    startTime: string;
    endTime: string;
    recordingUrl?: string;
    direction: 'Inbound' | 'Outbound';
  };
  transcript: string;
  customFields?: Record<string, any>;
  tags?: string[];
  expiresAt: string;
  status: 'DRAFT' | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED' | 'CREATED' | 'FAILED';
}

export interface DraftConfirmation {
  draftId: string;
  action: 'confirm' | 'cancel';
  modifiedData?: Partial<DraftTicketData>;
}