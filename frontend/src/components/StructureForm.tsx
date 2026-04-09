import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Button,
  Grid,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  Alert,
  InputAdornment,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import RemoveCircleOutlineOutlinedIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SpeedIcon from '@mui/icons-material/Speed';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ScienceIcon from '@mui/icons-material/Science';
import type { StructureInput } from '../types';
import { DEFAULT_INPUT } from '../types';

interface StructureFormProps {
  values: StructureInput;
  onChange: (values: StructureInput) => void;
  onAnalyze: () => void;
  onQuickCheck: () => void;
  loading: boolean;
  error: string | null;
}

function NumberField({
  label,
  value,
  unit,
  onChange,
  min,
  max,
  step = 0.1,
  disabled = false,
}: {
  label: string;
  value: number;
  unit?: string;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <TextField
      type="number"
      label={label}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      slotProps={{
        input: {
          endAdornment: unit ? (
            <InputAdornment position="end">
              <Typography variant="caption" color="text.secondary">
                {unit}
              </Typography>
            </InputAdornment>
          ) : undefined,
        },
        htmlInput: { min, max, step },
      }}
      disabled={disabled}
      fullWidth
      size="small"
    />
  );
}

function DynamicList({
  label,
  values,
  unit,
  onAdd,
  onRemove,
  onChange,
  minItems = 1,
  maxItems = 20,
}: {
  label: string;
  values: number[];
  unit?: string;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onChange: (idx: number, val: number) => void;
  minItems?: number;
  maxItems?: number;
}) {
  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
          {label}
        </Typography>
        <Tooltip title={`Add (max ${maxItems})`}>
          <span>
            <IconButton
              size="small"
              color="primary"
              onClick={onAdd}
              disabled={values.length >= maxItems}
            >
              <AddCircleOutlineOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      {values.map((val, idx) => (
        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 24 }}>
            {idx + 1}.
          </Typography>
          <TextField
            type="number"
            size="small"
            value={val}
            onChange={(e) => onChange(idx, parseFloat(e.target.value) || 0)}
            slotProps={{
              input: {
                endAdornment: unit ? (
                  <InputAdornment position="end">
                    <Typography variant="caption" color="text.secondary">
                      {unit}
                    </Typography>
                  </InputAdornment>
                ) : undefined,
              },
            }}
            fullWidth
          />
          <Tooltip title="Remove">
            <span>
              <IconButton
                size="small"
                color="error"
                onClick={() => onRemove(idx)}
                disabled={values.length <= minItems}
              >
                <RemoveCircleOutlineOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ))}
    </Box>
  );
}

export function StructureForm({
  values,
  onChange,
  onAnalyze,
  onQuickCheck,
  loading,
  error,
}: StructureFormProps) {
  const update = (partial: Partial<StructureInput>) => {
    onChange({ ...values, ...partial });
  };

  const updateList = (key: keyof StructureInput, idx: number, val: number) => {
    const list = [...(values[key] as number[])];
    list[idx] = val;
    update({ [key]: list });
  };

  const addToList = (key: keyof StructureInput, defaultVal: number) => {
    const list = [...(values[key] as number[]), defaultVal];
    update({ [key]: list });
  };

  const removeFromList = (key: keyof StructureInput, idx: number) => {
    const list = (values[key] as number[]).filter((_, i) => i !== idx);
    update({ [key]: list });
  };

  const handleNumStoreysChange = (n: number) => {
    const heights = [...values.storey_heights];
    while (heights.length < n) heights.push(3);
    while (heights.length > n) heights.pop();
    const forces = [...values.lateral_forces];
    while (forces.length < n) forces.push(20);
    while (forces.length > n) forces.pop();
    update({ num_storeys: n, storey_heights: heights, lateral_forces: forces });
  };

  const handleNumBaysChange = (n: number) => {
    const abc = [...values.bay_widths_abc];
    while (abc.length < n) abc.push(6);
    while (abc.length > n) abc.pop();
    const w123 = [...values.bay_widths_123];
    while (w123.length < n) w123.push(6);
    while (w123.length > n) w123.pop();
    update({ num_bays: n, bay_widths_abc: abc, bay_widths_123: w123 });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_INPUT });
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => {}}>
          {error}
        </Alert>
      )}

      {/* Geometry */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Geometry</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <NumberField
                label="Number of Storeys"
                value={values.num_storeys}
                onChange={handleNumStoreysChange}
                min={1}
                max={10}
                step={1}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <NumberField
                label="Number of Bays"
                value={values.num_bays}
                onChange={handleNumBaysChange}
                min={1}
                max={5}
                step={1}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <DynamicList
                label="Storey Heights"
                values={values.storey_heights}
                unit="m"
                onAdd={() => addToList('storey_heights', 3)}
                onRemove={(idx) => removeFromList('storey_heights', idx)}
                onChange={(idx, val) => updateList('storey_heights', idx, val)}
                minItems={values.num_storeys}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <DynamicList
                label="Bay Widths - Frame ABC"
                values={values.bay_widths_abc}
                unit="m"
                onAdd={() => addToList('bay_widths_abc', 6)}
                onRemove={(idx) => removeFromList('bay_widths_abc', idx)}
                onChange={(idx, val) => updateList('bay_widths_abc', idx, val)}
                minItems={values.num_bays}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <DynamicList
                label="Bay Widths - Frame 123"
                values={values.bay_widths_123}
                unit="m"
                onAdd={() => addToList('bay_widths_123', 6)}
                onRemove={(idx) => removeFromList('bay_widths_123', idx)}
                onChange={(idx, val) => updateList('bay_widths_123', idx, val)}
                minItems={values.num_bays}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Lateral Forces */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Lateral Forces</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <DynamicList
            label="Forces per Storey (top to bottom)"
            values={values.lateral_forces}
            unit="kN"
            onAdd={() => addToList('lateral_forces', 20)}
            onRemove={(idx) => removeFromList('lateral_forces', idx)}
            onChange={(idx, val) => updateList('lateral_forces', idx, val)}
            minItems={values.num_storeys}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Wind or seismic lateral forces applied at each floor level, listed from roof level downward.
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* Material & Loads */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Material &amp; Loads</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <NumberField
                label="Yield Strength (Fy)"
                value={values.fy}
                unit="MPa"
                onChange={(v) => update({ fy: v })}
                min={200}
                max={500}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <NumberField
                label="Live Load"
                value={values.live_load}
                unit="kPa"
                onChange={(v) => update({ live_load: v })}
                min={0}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <NumberField
                label="Beam Weight"
                value={values.beam_weight}
                unit="kN/m"
                onChange={(v) => update({ beam_weight: v })}
                min={0}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <NumberField
                label="Slab Weight"
                value={values.slab_weight}
                unit="kPa"
                onChange={(v) => update({ slab_weight: v })}
                min={0}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <NumberField
                label="Wall Weight"
                value={values.wall_weight}
                unit="kPa"
                onChange={(v) => update({ wall_weight: v })}
                min={0}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <NumberField
                label="Parapet Weight"
                value={values.parapet_weight}
                unit="kPa"
                onChange={(v) => update({ parapet_weight: v })}
                min={0}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Design Parameters */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Design Parameters</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <NumberField
                label="Unbraced Length (Beam)"
                value={values.unbraced_length_beam}
                unit="mm"
                onChange={(v) => update({ unbraced_length_beam: v })}
                min={0}
                step={100}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <NumberField
                label="Unbraced Length (Column)"
                value={values.unbraced_length_column}
                unit="mm"
                onChange={(v) => update({ unbraced_length_column: v })}
                min={0}
                step={100}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <NumberField
                label="Number of Frames"
                value={values.num_frames}
                onChange={(v) => update({ num_frames: v })}
                min={1}
                max={10}
                step={1}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Divider sx={{ my: 2 }} />

      {/* Action Buttons */}
      <Stack direction="column" spacing={1.5}>
        <Button
          variant="contained"
          size="large"
          startIcon={<PlayArrowIcon />}
          onClick={onAnalyze}
          disabled={loading}
          fullWidth
          sx={{ py: 1.5 }}
        >
          Run Full Analysis
        </Button>
        <Button
          variant="outlined"
          size="large"
          startIcon={<SpeedIcon />}
          onClick={onQuickCheck}
          disabled={loading}
          fullWidth
          color="secondary"
        >
          Quick Check
        </Button>
        <Stack direction="row" spacing={1}>
          <Button
            variant="text"
            startIcon={<RestartAltIcon />}
            onClick={handleReset}
            disabled={loading}
            fullWidth
          >
            Reset
          </Button>
          <Button
            variant="text"
            startIcon={<ScienceIcon />}
            onClick={handleReset}
            disabled={loading}
            fullWidth
            color="primary"
          >
            Load Example (Pihuts)
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
