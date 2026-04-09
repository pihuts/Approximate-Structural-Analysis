import { Box, Typography, CircularProgress } from '@mui/material';
import { LinearProgress } from '@mui/material';

interface LoadingOverlayProps {
  loading: boolean;
  message?: string;
  children: React.ReactNode;
}

export function LoadingOverlay({ loading, message, children }: LoadingOverlayProps) {
  if (!loading) {
    return <>{children}</>;
  }

  return (
    <Box sx={{ position: 'relative', minHeight: 200 }}>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          zIndex: 10,
          borderRadius: 2,
        }}
      >
        <CircularProgress size={48} sx={{ mb: 2, color: 'primary.main' }} />
        <Typography variant="body1" color="text.secondary">
          {message || 'Running analysis...'}
        </Typography>
        <LinearProgress
          sx={{
            mt: 2,
            width: 200,
            borderRadius: 1,
            height: 4,
          }}
        />
      </Box>
      {children}
    </Box>
  );
}
