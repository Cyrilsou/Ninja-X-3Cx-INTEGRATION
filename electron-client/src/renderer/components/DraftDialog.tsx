import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  Divider,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Paper
} from '@mui/material';
import {
  Phone,
  Person,
  AccessTime,
  Headset,
  ContentCopy,
  OpenInNew
} from '@mui/icons-material';
import dayjs from 'dayjs';

interface DraftDialogProps {
  open: boolean;
  draft: any;
  onClose: () => void;
  onConfirm: (draftId: string, modifiedData?: any) => void;
  onCancel: (draftId: string) => void;
}

const DraftDialog: React.FC<DraftDialogProps> = ({
  open,
  draft,
  onClose,
  onConfirm,
  onCancel
}) => {
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  const [priority, setPriority] = useState(draft.priority);
  const [type, setType] = useState(draft.type || 'REQUEST');

  const handleConfirm = () => {
    const hasChanges = 
      title !== draft.title ||
      description !== draft.description ||
      priority !== draft.priority ||
      type !== draft.type;

    const modifiedData = hasChanges ? {
      title,
      description,
      priority,
      type
    } : undefined;

    onConfirm(draft.id, modifiedData);
  };

  const handleCancel = () => {
    onCancel(draft.id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const openRecording = () => {
    if (draft.callInfo.recordingUrl) {
      window.electronAPI.openExternal(draft.callInfo.recordingUrl);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Review Call Draft</Typography>
          <Chip
            label={`Expires ${dayjs(draft.expiresAt).fromNow()}`}
            size="small"
            color="warning"
          />
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Call Information */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom color="text.secondary">
                Call Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Person sx={{ fontSize: 20, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {draft.contactInfo?.name || 'Unknown'} • {draft.contactInfo?.phone || 'No number'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <AccessTime sx={{ fontSize: 20, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {dayjs(draft.callInfo.endTime).format('MMM D, YYYY h:mm A')} • {formatDuration(draft.callInfo.duration)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Phone sx={{ fontSize: 20, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {draft.callInfo.direction} Call
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Headset sx={{ fontSize: 20, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {draft.agentInfo.name || draft.agentInfo.extension}
                    </Typography>
                    {draft.callInfo.recordingUrl && (
                      <Tooltip title="Open recording">
                        <IconButton size="small" onClick={openRecording}>
                          <OpenInNew sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Ticket Fields */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              error={!title.trim()}
              helperText={!title.trim() ? 'Title is required' : ''}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                label="Priority"
              >
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="NORMAL">Normal</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="CRITICAL">Critical</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value)}
                label="Type"
              >
                <MenuItem value="REQUEST">Request</MenuItem>
                <MenuItem value="INCIDENT">Incident</MenuItem>
                <MenuItem value="PROBLEM">Problem</MenuItem>
                <MenuItem value="TASK">Task</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={6}
              required
              error={!description.trim()}
              helperText={!description.trim() ? 'Description is required' : ''}
            />
          </Grid>

          {/* Transcript */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Call Transcript
                </Typography>
                <Tooltip title="Copy transcript">
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(draft.transcript)}
                  >
                    <ContentCopy sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography
                variant="body2"
                sx={{
                  maxHeight: 200,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  backgroundColor: 'grey.50',
                  p: 2,
                  borderRadius: 1
                }}
              >
                {draft.transcript}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleCancel} color="error">
          Cancel Draft
        </Button>
        <Box sx={{ flex: '1 0 0' }} />
        <Button onClick={onClose}>
          Close
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!title.trim() || !description.trim()}
        >
          Create Ticket
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DraftDialog;