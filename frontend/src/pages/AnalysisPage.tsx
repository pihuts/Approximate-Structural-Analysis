import { useState, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Snackbar,
  Alert,
} from '@mui/material';
import { StructureForm } from '../components/StructureForm';
import { AnalysisDashboard } from '../components/AnalysisDashboard';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { analyzeStructure, analyzeFast, ApiError } from '../api';
import type { StructureInput, AnalysisResult } from '../types';
import { DEFAULT_INPUT } from '../types';

export function AnalysisPage() {
  const [params, setParams] = useState<StructureInput>({ ...DEFAULT_INPUT });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [fastResult, setFastResult] = useState<{
    computed_values: AnalysisResult['computed_values'];
    summary: string;
  } | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFastResult(null);
    try {
      const data = await analyzeStructure(params);
      setResult(data);
      showSnackbar('Full analysis completed successfully!', 'success');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Analysis failed. Check that the backend is running.';
      setError(msg);
      showSnackbar(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [params]);

  const handleQuickCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFastResult(null);
    try {
      const data = await analyzeFast(params);
      setFastResult(data);
      showSnackbar('Quick check completed!', 'success');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Quick check failed. Check that the backend is running.';
      setError(msg);
      showSnackbar(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [params]);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        Structural Analysis
      </Typography>

      <LoadingOverlay loading={loading} message="Running structural analysis...">
        <Grid container spacing={3}>
          {/* Left Panel - Form */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2, position: 'sticky', top: 80 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Input Parameters
              </Typography>
              <StructureForm
                values={params}
                onChange={setParams}
                onAnalyze={handleAnalyze}
                onQuickCheck={handleQuickCheck}
                loading={loading}
                error={error}
              />
            </Paper>
          </Grid>

          {/* Right Panel - Results */}
          <Grid size={{ xs: 12, md: 8 }}>
            <AnalysisDashboard
              result={result}
              fastResult={fastResult}
              loading={loading}
            />
          </Grid>
        </Grid>
      </LoadingOverlay>

      {/* Snackbar notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
