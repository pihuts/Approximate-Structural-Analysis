import {
  Box,
  Paper,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Alert,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { DesignCheck } from '../types';

interface DesignResultsProps {
  title: string;
  checks: DesignCheck[];
}

function StatusChip({ status }: { status: string }) {
  switch (status) {
    case 'safe':
      return (
        <Chip
          icon={<CheckCircleIcon />}
          label="Safe"
          size="small"
          color="success"
          variant="outlined"
          sx={{ fontWeight: 500 }}
        />
      );
    case 'unsafe':
      return (
        <Chip
          icon={<CancelIcon />}
          label="Unsafe"
          size="small"
          color="error"
          variant="outlined"
          sx={{ fontWeight: 500 }}
        />
      );
    case 'warning':
      return (
        <Chip
          icon={<WarningAmberIcon />}
          label="Warning"
          size="small"
          color="warning"
          variant="outlined"
          sx={{ fontWeight: 500 }}
        />
      );
    default:
      return <Chip label={status} size="small" />;
  }
}

function ratioColor(ratio: number): string {
  if (ratio <= 0.8) return 'success.main';
  if (ratio <= 1.0) return 'warning.main';
  return 'error.main';
}

export function DesignResults({ title, checks }: DesignResultsProps) {
  if (!checks || checks.length === 0) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No design checks available.
        </Typography>
      </Paper>
    );
  }

  const unsafeCount = checks.filter((c) => c.status === 'unsafe').length;
  const warningCount = checks.filter((c) => c.status === 'warning').length;
  const safeCount = checks.filter((c) => c.status === 'safe').length;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {title}
      </Typography>

      {/* Summary chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Chip
          icon={<CheckCircleIcon />}
          label={`${safeCount} Safe`}
          color="success"
          size="small"
        />
        <Chip
          icon={<WarningAmberIcon />}
          label={`${warningCount} Warning`}
          color="warning"
          size="small"
        />
        <Chip
          icon={<CancelIcon />}
          label={`${unsafeCount} Unsafe`}
          color="error"
          size="small"
        />
      </Box>

      {unsafeCount > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {unsafeCount} member(s) do not satisfy design requirements.
        </Alert>
      )}

      <Divider sx={{ mb: 2 }} />

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Member</TableCell>
              <TableCell>Section</TableCell>
              <TableCell align="right">Demand</TableCell>
              <TableCell align="right">Capacity</TableCell>
              <TableCell align="right">Ratio</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell>Check</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {checks.map((check, idx) => (
              <TableRow key={idx} hover>
                <TableCell sx={{ fontWeight: 500 }}>{check.member}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{check.section}</TableCell>
                <TableCell align="right">{check.demand.toFixed(2)}</TableCell>
                <TableCell align="right">{check.capacity.toFixed(2)}</TableCell>
                <TableCell
                  align="right"
                  sx={{ fontWeight: 600, color: ratioColor(check.ratio) }}
                >
                  {check.ratio.toFixed(3)}
                </TableCell>
                <TableCell align="center">
                  <StatusChip status={check.status} />
                </TableCell>
                <TableCell sx={{ fontSize: '0.8rem' }}>
                  {check.description || check.check_type}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
