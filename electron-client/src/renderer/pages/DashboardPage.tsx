import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Divider,
  Chip,
  Button,
  Stack
} from '@mui/material';
import {
  Phone,
  AccessTime,
  CheckCircle,
  Cancel,
  History
} from '@mui/icons-material';
import DraftDialog from '../components/DraftDialog';
import { useNotification } from '../contexts/NotificationContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface DraftTicket {
  id: string;
  callId: string;
  title: string;
  description: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  transcript: string;
  callInfo: {
    duration: number;
    startTime: string;
    endTime: string;
    direction: string;
  };
  contactInfo?: {
    phone?: string;
    name?: string;
  };
  expiresAt: string;
  status: string;
}

interface Stats {
  totalDrafts: number;
  confirmedToday: number;
  cancelledToday: number;
  pendingDrafts: number;
}

const DashboardPage: React.FC = () => {
  const { showNotification } = useNotification();
  const [drafts, setDrafts] = useState<DraftTicket[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<DraftTicket | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalDrafts: 0,
    confirmedToday: 0,
    cancelledToday: 0,
    pendingDrafts: 0
  });

  useEffect(() => {
    // Listen for new drafts
    window.electronAPI.on('new-draft', handleNewDraft);
    window.electronAPI.on('ticket-created', handleTicketCreated);

    return () => {
      window.electronAPI.removeListener('new-draft', handleNewDraft);
      window.electronAPI.removeListener('ticket-created', handleTicketCreated);
    };
  }, []);

  const handleNewDraft = (draft: DraftTicket) => {
    setDrafts(prev => [draft, ...prev]);
    setStats(prev => ({
      ...prev,
      totalDrafts: prev.totalDrafts + 1,
      pendingDrafts: prev.pendingDrafts + 1
    }));
    
    // Auto-open the draft dialog
    setSelectedDraft(draft);
    setDialogOpen(true);
    
    showNotification('New call draft received', 'info');
  };

  const handleTicketCreated = (data: any) => {
    setDrafts(prev => prev.map(d => 
      d.id === data.draftId 
        ? { ...d, status: 'CREATED' }
        : d
    ));
    
    showNotification(`Ticket #${data.ticketNumber} created successfully`, 'success');
  };

  const handleConfirm = async (draftId: string, modifiedData?: any) => {
    window.electronAPI.confirmDraft(draftId, modifiedData);
    
    setDrafts(prev => prev.map(d => 
      d.id === draftId 
        ? { ...d, status: 'CONFIRMING' }
        : d
    ));
    
    setStats(prev => ({
      ...prev,
      confirmedToday: prev.confirmedToday + 1,
      pendingDrafts: prev.pendingDrafts - 1
    }));
    
    setDialogOpen(false);
  };

  const handleCancel = async (draftId: string) => {
    window.electronAPI.cancelDraft(draftId);
    
    setDrafts(prev => prev.map(d => 
      d.id === draftId 
        ? { ...d, status: 'CANCELLED' }
        : d
    ));
    
    setStats(prev => ({
      ...prev,
      cancelledToday: prev.cancelledToday + 1,
      pendingDrafts: prev.pendingDrafts - 1
    }));
    
    setDialogOpen(false);
    showNotification('Draft cancelled', 'warning');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'error';
      case 'HIGH': return 'warning';
      case 'NORMAL': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CREATED':
      case 'CONFIRMED':
        return <CheckCircle color="success" />;
      case 'CANCELLED':
        return <Cancel color="error" />;
      default:
        return <AccessTime color="warning" />;
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Agent Dashboard
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary" gutterBottom>
              Total Drafts Today
            </Typography>
            <Typography variant="h4">
              {stats.totalDrafts}
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary" gutterBottom>
              Pending
            </Typography>
            <Typography variant="h4" color="warning.main">
              {stats.pendingDrafts}
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary" gutterBottom>
              Confirmed
            </Typography>
            <Typography variant="h4" color="success.main">
              {stats.confirmedToday}
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary" gutterBottom>
              Cancelled
            </Typography>
            <Typography variant="h4" color="error.main">
              {stats.cancelledToday}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Recent Drafts
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        {drafts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <History sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography color="text.secondary">
              No drafts yet. They will appear here when calls end.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {drafts.map((draft) => (
              <Paper
                key={draft.id}
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: draft.status === 'PENDING_CONFIRMATION' ? 'pointer' : 'default',
                  '&:hover': draft.status === 'PENDING_CONFIRMATION' ? {
                    backgroundColor: 'action.hover'
                  } : {}
                }}
                onClick={() => {
                  if (draft.status === 'PENDING_CONFIRMATION') {
                    setSelectedDraft(draft);
                    setDialogOpen(true);
                  }
                }}
              >
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center" gap={2}>
                    {getStatusIcon(draft.status)}
                    <Box>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {draft.contactInfo?.name || draft.contactInfo?.phone || 'Unknown Caller'}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Phone sx={{ fontSize: 16 }} />
                        <Typography variant="body2" color="text.secondary">
                          {formatDuration(draft.callInfo.duration)} • {dayjs(draft.callInfo.endTime).fromNow()}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip
                      label={draft.priority}
                      size="small"
                      color={getPriorityColor(draft.priority) as any}
                    />
                    {draft.status === 'PENDING_CONFIRMATION' && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDraft(draft);
                          setDialogOpen(true);
                        }}
                      >
                        Review
                      </Button>
                    )}
                  </Box>
                </Box>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      {selectedDraft && (
        <DraftDialog
          open={dialogOpen}
          draft={selectedDraft}
          onClose={() => setDialogOpen(false)}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </Box>
  );
};

export default DashboardPage;