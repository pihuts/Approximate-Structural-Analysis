import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  SxProps,
  Theme,
} from '@mui/material';

interface Column {
  id: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  format?: (value: unknown) => string;
}

interface ResultsTableProps {
  title?: string;
  columns: Column[];
  rows: Record<string, unknown>[];
  dense?: boolean;
  sx?: SxProps<Theme>;
  highlightFn?: (row: Record<string, unknown>) => 'success' | 'error' | 'warning' | null;
}

export function ResultsTable({
  title,
  columns,
  rows,
  dense = false,
  sx,
  highlightFn,
}: ResultsTableProps) {
  if (!rows || rows.length === 0) {
    return (
      <Paper sx={{ p: 2, ...sx }}>
        <Typography variant="body2" color="text.secondary">
          No data available.
        </Typography>
      </Paper>
    );
  }

  const getRowBg = (row: Record<string, unknown>) => {
    if (!highlightFn) return undefined;
    const status = highlightFn(row);
    if (status === 'success') return 'rgba(46, 125, 50, 0.06)';
    if (status === 'error') return 'rgba(198, 40, 40, 0.06)';
    if (status === 'warning') return 'rgba(245, 127, 23, 0.06)';
    return undefined;
  };

  return (
    <Box sx={sx}>
      {title && (
        <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main' }}>
          {title}
        </Typography>
      )}
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ maxHeight: 600 }}
      >
        <Table size={dense ? 'small' : 'medium'} stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  align={col.align || 'left'}
                  sx={{ minWidth: col.width || 'auto' }}
                >
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow
                key={idx}
                hover
                sx={{ backgroundColor: getRowBg(row) }}
              >
                {columns.map((col) => {
                  const value = row[col.id];
                  const displayValue =
                    col.format && value !== undefined
                      ? col.format(value)
                      : String(value ?? '-');
                  return (
                    <TableCell
                      key={col.id}
                      align={col.align || 'left'}
                    >
                      {displayValue}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
