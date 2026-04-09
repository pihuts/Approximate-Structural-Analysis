import { useState } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import FunctionsIcon from '@mui/icons-material/Functions';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import type { AnalysisResult, LatexBlock as LatexBlockType } from '../types';
import { LatexBlock, LatexBlockList } from './LatexBlock';
import { ResultsTable } from './ResultsTable';
import { DesignResults } from './DesignResults';

interface AnalysisDashboardProps {
  result: AnalysisResult | null;
  fastResult?: {
    computed_values: AnalysisResult['computed_values'];
    summary: string;
  } | null;
  loading: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, index, value }: TabPanelProps) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`analysis-tabpanel-${index}`}
      aria-labelledby={`analysis-tab-${index}`}
      sx={{ pt: 2 }}
    >
      {value === index && <Box>{children}</Box>}
    </Box>
  );
}

function filterBlocks(
  blocks: LatexBlockType[],
  category: string
): LatexBlockType[] {
  if (!blocks) return [];
  return blocks.filter((b) => b.category === category || b.step_title?.toLowerCase().includes(category));
}

function extractComputedRows(
  values: AnalysisResult['computed_values'],
  filterPrefix?: string
): Record<string, unknown>[] {
  if (!values) return [];

  // Backend returns computed_values as a dict {key: value}
  // but the code expects an array of {name, value, unit, ...} objects
  let entries: { name: string; value: number; unit?: string; member?: string; storey?: number; bay?: number }[];

  if (Array.isArray(values)) {
    entries = values.map((v) => ({
      name: v.name,
      value: v.value,
      unit: v.unit,
      member: v.member,
      storey: v.storey,
      bay: v.bay,
    }));
  } else {
    // Convert dict to array of named entries
    entries = Object.entries(values).map(([name, value]) => ({
      name,
      value: typeof value === 'number' ? value : 0,
    }));
  }

  if (filterPrefix) {
    entries = entries.filter(
      (v) =>
        v.name.toLowerCase().includes(filterPrefix) ||
        (v.member?.toLowerCase().includes(filterPrefix)) ||
        v.storey !== undefined
    );
  }

  return entries.map((v) => ({
    name: v.name,
    value: v.value,
    unit: v.unit || '',
    storey: v.storey ?? '',
    bay: v.bay ?? '',
    member: v.member || '',
  }));
}

export function AnalysisDashboard({ result, fastResult, loading }: AnalysisDashboardProps) {
  const [activeTab, setActiveTab] = useState(0);

  if (!result && !fastResult) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Analysis Results
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure the structure parameters on the left and click "Run Analysis" to see results.
        </Typography>
      </Paper>
    );
  }

  if (fastResult && !result) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Quick Check Results
        </Typography>
        <Alert severity="success" sx={{ mb: 2 }}>
          Quick check completed successfully.
        </Alert>
        <ResultsTable
          title="Computed Values"
          columns={[
            { id: 'name', label: 'Parameter', width: 200 },
            { id: 'value', label: 'Value', align: 'right', format: (v) => typeof v === 'number' ? v.toFixed(4) : String(v) },
            { id: 'unit', label: 'Unit', width: 80 },
          ]}
          rows={extractComputedRows(fastResult.computed_values)}
          dense
        />
        {fastResult.summary && (
          <Paper sx={{ p: 2, mt: 2, bgcolor: '#F5F5F5' }}>
            <Typography variant="body2">{fastResult.summary}</Typography>
          </Paper>
        )}
      </Paper>
    );
  }

  if (!result) return null;

  const blocks = result.latex_blocks || [];
  const beamBlocks = blocks.filter(
    (b) => b.category === 'beam_design' || b.step_title?.toLowerCase().includes('beam')
  );
  const columnBlocks = blocks.filter(
    (b) => b.category === 'column_design' || b.step_title?.toLowerCase().includes('column')
  );
  const portalBlocks = blocks.filter(
    (b) => b.category === 'portal' || b.step_title?.toLowerCase().includes('portal')
  );
  const gravityBlocks = blocks.filter(
    (b) => b.category === 'gravity' || b.step_title?.toLowerCase().includes('gravity')
  );
  const comboBlocks = blocks.filter(
    (b) => b.category === 'combinations' || b.step_title?.toLowerCase().includes('combin')
  );

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box>
      {/* Summary bar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            Analysis Complete
          </Typography>
          <Chip
            label={`${blocks.length} equations`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`${Array.isArray(result.computed_values) ? result.computed_values.length : Object.keys(result.computed_values || {}).length} values`}
            size="small"
            variant="outlined"
          />
          {(result.design_results?.beams?.length || 0) > 0 && (
            <Chip
              label={`${result.design_results.beams.length} beam checks`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
          {(result.design_results?.columns?.length || 0) > 0 && (
            <Chip
              label={`${result.design_results.columns.length} column checks`}
              size="small"
              color="secondary"
              variant="outlined"
            />
          )}
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab icon={<FunctionsIcon fontSize="small" />} iconPosition="start" label="Portal Method" />
          <Tab icon={<VerticalAlignBottomIcon fontSize="small" />} iconPosition="start" label="Gravity Loads" />
          <Tab icon={<MergeTypeIcon fontSize="small" />} iconPosition="start" label="Combinations" />
          <Tab icon={<ViewStreamIcon fontSize="small" />} iconPosition="start" label="Beam Design" />
          <Tab icon={<ViewColumnIcon fontSize="small" />} iconPosition="start" label="Column Design" />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        <Typography variant="h6" gutterBottom>
          Portal Method - Lateral Force Analysis
        </Typography>
        <Divider sx={{ mb: 2 }} />
        {portalBlocks.length > 0 ? (
          <LatexBlockList blocks={portalBlocks} />
        ) : blocks.length > 0 ? (
          <LatexBlockList blocks={blocks.slice(0, Math.ceil(blocks.length / 5))} />
        ) : (
          <Alert severity="info">No portal method calculations available.</Alert>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Typography variant="h6" gutterBottom>
          Gravity Load Analysis
        </Typography>
        <Divider sx={{ mb: 2 }} />
        {gravityBlocks.length > 0 ? (
          <LatexBlockList blocks={gravityBlocks} />
        ) : (
          <Alert severity="info">No gravity load calculations available.</Alert>
        )}
        <ResultsTable
          title="Computed Values"
          columns={[
            { id: 'name', label: 'Parameter', width: 200 },
            { id: 'value', label: 'Value', align: 'right', format: (v) => typeof v === 'number' ? v.toFixed(4) : String(v) },
            { id: 'unit', label: 'Unit', width: 80 },
          ]}
          rows={extractComputedRows(result.computed_values, 'gravity')}
          dense
          sx={{ mt: 2 }}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <Typography variant="h6" gutterBottom>
          Load Combinations
        </Typography>
        <Divider sx={{ mb: 2 }} />
        {comboBlocks.length > 0 ? (
          <LatexBlockList blocks={comboBlocks} />
        ) : (
          <Alert severity="info">No load combination calculations available.</Alert>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <DesignResults
          title="Beam Design Checks (AISC)"
          checks={result.design_results?.beams || []}
        />
        {beamBlocks.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Beam Design Calculations
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <LatexBlockList blocks={beamBlocks} />
          </Box>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={4}>
        <DesignResults
          title="Column Design Checks (AISC)"
          checks={result.design_results?.columns || []}
        />
        {columnBlocks.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Column Design Calculations
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <LatexBlockList blocks={columnBlocks} />
          </Box>
        )}
      </TabPanel>
    </Box>
  );
}
