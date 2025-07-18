export interface NinjaOneToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface NinjaOneContact {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  organizationId?: number;
  primaryContact?: boolean;
  customFields?: Record<string, any>;
}

export interface NinjaOneTicket {
  id?: number;
  ticketNumber?: string;
  subject: string;
  description: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  status?: 'NEW' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
  type?: 'PROBLEM' | 'REQUEST' | 'INCIDENT' | 'TASK';
  boardId: number;
  contactId?: number;
  assignedToId?: number;
  customFields?: Record<string, any>;
  tags?: string[];
  attachments?: NinjaOneAttachment[];
}

export interface NinjaOneAttachment {
  fileName: string;
  contentType: string;
  content: string; // Base64 encoded
}

export interface NinjaOneUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  extension?: string;
  userType: string;
  enabled: boolean;
}

export interface NinjaOneBoard {
  id: number;
  name: string;
  description?: string;
  isDefault: boolean;
}

export interface NinjaOneOrganization {
  id: number;
  name: string;
  description?: string;
}

export interface NinjaOneError {
  error: string;
  error_description?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}