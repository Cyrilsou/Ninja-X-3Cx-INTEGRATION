import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from './database';
import { NinjaOneService } from './ninjaone';
import { WebSocketService } from './websocket';
import { logger } from '../utils/logger';
import { config } from '../config';
import { DraftTicketData } from '../types/draft.types';
import { NinjaOneTicket } from '../types/ninjaone.types';

export class DraftProcessor {
  private static instance: DraftProcessor;
  private ninjaOne: NinjaOneService;
  private websocket: WebSocketService;

  private constructor() {
    this.ninjaOne = NinjaOneService.getInstance();
    this.websocket = WebSocketService.getInstance();
    this.setupEventHandlers();
  }

  static getInstance(): DraftProcessor {
    if (!this.instance) {
      this.instance = new DraftProcessor();
    }
    return this.instance;
  }

  private setupEventHandlers(): void {
    // Handle draft confirmations from WebSocket
    this.websocket.on('draftConfirmed', async (data) => {
      await this.processDraftConfirmation(data);
    });

    // Handle draft cancellations
    this.websocket.on('draftCancelled', async (data) => {
      await this.processDraftCancellation(data);
    });
  }

  async createDraftFromCall(callId: string, transcript: string, callData: any): Promise<void> {
    try {
      logger.info('Creating draft from call', { callId });

      // Find or create contact
      let contactId: number | undefined;
      if (callData.caller_number) {
        const contacts = await this.ninjaOne.searchContacts(callData.caller_number);
        if (contacts.length > 0) {
          contactId = contacts[0].id;
        } else {
          // Create new contact
          const newContact = await this.ninjaOne.createContact({
            phone: callData.caller_number,
            firstName: callData.caller_name || 'Unknown',
            lastName: 'Caller'
          });
          if (newContact) {
            contactId = newContact.id;
          }
        }
      }

      // Find NinjaOne user by extension
      const ninjaUser = await this.ninjaOne.searchUserByExtension(callData.extension);

      // Prepare draft data
      const draft: DraftTicketData = {
        id: uuidv4(),
        callId,
        title: this.generateTicketTitle(callData, transcript),
        description: this.generateTicketDescription(callData, transcript),
        priority: this.determinePriority(transcript),
        type: 'REQUEST',
        contactInfo: contactId ? {
          id: contactId,
          phone: callData.caller_number,
          name: callData.caller_name
        } : undefined,
        agentInfo: {
          extension: callData.extension,
          name: callData.agent_name,
          ninjaUserId: ninjaUser?.id
        },
        callInfo: {
          duration: callData.duration,
          startTime: callData.start_time,
          endTime: callData.end_time,
          recordingUrl: callData.recording_url,
          direction: callData.direction || 'Inbound'
        },
        transcript,
        customFields: {
          callId: callId,
          extension: callData.extension,
          transcriptionGenerated: true
        },
        tags: ['3CX', 'AutoTranscribed'],
        expiresAt: new Date(Date.now() + config.DRAFT_EXPIRATION_MINUTES * 60000).toISOString(),
        status: 'PENDING_CONFIRMATION'
      };

      // Save draft to database
      await DatabaseService.createDraftTicket(draft);

      // Send draft to agent(s)
      const extensions = [callData.extension];
      this.websocket.sendDraftToAgents(extensions, draft);

      // Update call status
      await DatabaseService.updateCall(callId, {
        status: 'DRAFT_CREATED'
      });

      logger.info('Draft created and sent to agents', {
        draftId: draft.id,
        callId,
        extensions
      });

      // Schedule auto-creation after expiration
      setTimeout(async () => {
        await this.checkAndAutoCreateTicket(draft.id);
      }, config.DRAFT_EXPIRATION_MINUTES * 60000);

    } catch (error) {
      logger.error('Failed to create draft from call', { callId, error });
      throw error;
    }
  }

  private async processDraftConfirmation(data: any): Promise<void> {
    try {
      const { draftId, extension, modifiedData } = data;
      
      logger.info('Processing draft confirmation', { draftId, extension });

      // Get draft from database
      const draftRecord = await DatabaseService.getDraftTicket(draftId);
      if (!draftRecord) {
        logger.error('Draft not found', { draftId });
        return;
      }

      const draft = draftRecord.draft_data as DraftTicketData;

      // Apply modifications if any
      if (modifiedData) {
        Object.assign(draft, modifiedData);
      }

      // Create ticket in NinjaOne
      const ticketData: NinjaOneTicket = {
        subject: draft.title,
        description: draft.description,
        priority: draft.priority,
        type: draft.type,
        boardId: 0, // Will be set by NinjaOne service
        contactId: draft.contactInfo?.id,
        assignedToId: draft.agentInfo.ninjaUserId,
        customFields: draft.customFields,
        tags: draft.tags
      };

      const createdTicket = await this.ninjaOne.createTicket(ticketData);

      if (createdTicket) {
        // Update database
        await DatabaseService.updateDraftTicket(draftId, 'CREATED');
        await DatabaseService.createTicket(
          draftId,
          draft.callId,
          createdTicket.id!.toString(),
          createdTicket.ticketNumber!,
          createdTicket,
          extension
        );

        // Update call status
        await DatabaseService.updateCall(draft.callId, {
          status: 'TICKET_CREATED'
        });

        // Notify agent and TV
        this.websocket.sendTicketCreated([extension], {
          ticketId: createdTicket.id,
          ticketNumber: createdTicket.ticketNumber,
          draftId,
          callId: draft.callId
        });

        // Add transcript as internal comment
        if (draft.transcript) {
          await this.ninjaOne.addTicketComment(
            createdTicket.id!,
            `Call Transcript:\n\n${draft.transcript}`,
            true
          );
        }

        logger.info('Ticket created successfully', {
          ticketId: createdTicket.id,
          ticketNumber: createdTicket.ticketNumber,
          draftId
        });

      } else {
        throw new Error('Failed to create ticket in NinjaOne');
      }

    } catch (error) {
      logger.error('Failed to process draft confirmation', error);
      
      // Update draft status to failed
      if (data.draftId) {
        await DatabaseService.updateDraftTicket(data.draftId, 'FAILED');
      }
    }
  }

  private async processDraftCancellation(data: any): Promise<void> {
    try {
      const { draftId, extension } = data;
      
      logger.info('Processing draft cancellation', { draftId, extension });

      await DatabaseService.updateDraftTicket(draftId, 'CANCELLED');

      // Log audit event
      await DatabaseService.logAuditEvent(
        'DRAFT_CANCELLED',
        'draft',
        draftId,
        extension,
        undefined,
        { cancelledBy: extension }
      );

    } catch (error) {
      logger.error('Failed to process draft cancellation', error);
    }
  }

  private async checkAndAutoCreateTicket(draftId: string): Promise<void> {
    try {
      const draftRecord = await DatabaseService.getDraftTicket(draftId);
      
      if (!draftRecord || draftRecord.status !== 'PENDING_CONFIRMATION') {
        return;
      }

      logger.info('Auto-creating ticket for expired draft', { draftId });

      // Process as if confirmed
      await this.processDraftConfirmation({
        draftId,
        extension: 'system',
        modifiedData: null
      });

    } catch (error) {
      logger.error('Failed to auto-create ticket', { draftId, error });
    }
  }

  private generateTicketTitle(callData: any, transcript: string): string {
    const firstWords = transcript.split(' ').slice(0, 10).join(' ');
    const caller = callData.caller_name || callData.caller_number || 'Unknown';
    return `Call from ${caller} - ${firstWords}...`;
  }

  private generateTicketDescription(callData: any, transcript: string): string {
    const template = `
**Call Information**
- Date: ${new Date(callData.end_time).toLocaleString()}
- Duration: ${Math.floor(callData.duration / 60)}m ${callData.duration % 60}s
- Direction: ${callData.direction || 'Inbound'}
- Caller: ${callData.caller_name || 'Unknown'} (${callData.caller_number || 'Unknown'})
- Agent: ${callData.agent_name || 'Unknown'} (Ext: ${callData.extension})

**Transcription**
${transcript}

**Recording**
${callData.recording_url ? `[Click here to listen](${callData.recording_url})` : 'No recording available'}

---
*This ticket was automatically generated from a 3CX call with AI transcription.*
    `.trim();

    return template;
  }

  private determinePriority(transcript: string): 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' {
    const urgentKeywords = ['urgent', 'emergency', 'critical', 'asap', 'immediately'];
    const highKeywords = ['important', 'priority', 'soon', 'quickly'];
    
    const lowerTranscript = transcript.toLowerCase();
    
    if (urgentKeywords.some(keyword => lowerTranscript.includes(keyword))) {
      return 'CRITICAL';
    }
    
    if (highKeywords.some(keyword => lowerTranscript.includes(keyword))) {
      return 'HIGH';
    }
    
    return 'NORMAL';
  }
}