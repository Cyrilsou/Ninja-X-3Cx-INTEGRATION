export enum CallStatus {
  RECEIVED = 'RECEIVED',
  DOWNLOADING = 'DOWNLOADING',
  DOWNLOADED = 'DOWNLOADED',
  TRANSCRIBING = 'TRANSCRIBING',
  TRANSCRIBED = 'TRANSCRIBED',
  DRAFT_CREATED = 'DRAFT_CREATED',
  TICKET_CREATED = 'TICKET_CREATED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED'
}

export interface Call {
  id: string;
  callId: string;
  extension: string;
  agentName?: string;
  callerNumber?: string;
  callerName?: string;
  duration: number;
  startTime: Date;
  endTime: Date;
  recordingUrl?: string;
  localRecordingPath?: string;
  transcript?: string;
  status: CallStatus;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DraftTicket {
  id: string;
  callId: string;
  draftData: any;
  agentExtension: string;
  status: 'DRAFT' | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED' | 'CREATED' | 'FAILED';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentSession {
  id: string;
  extension: string;
  agentName?: string;
  jwtTokenHash: string;
  ipAddress?: string;
  userAgent?: string;
  lastActivity: Date;
  createdAt: Date;
  expiresAt: Date;
}