// Structure Input Parameters
export interface StructureInput {
  // Geometry
  num_storeys: number;
  num_bays: number;
  storey_heights: number[];        // meters
  bay_widths_abc: number[];        // meters - frame ABC
  bay_widths_123: number[];        // meters - frame 123

  // Lateral Forces
  lateral_forces: number[];        // kN, per storey (top-down)

  // Material & Loads
  fy: number;                      // MPa
  live_load: number;               // kPa
  beam_weight: number;             // kN/m
  slab_weight: number;             // kPa
  wall_weight: number;             // kPa
  parapet_weight: number;          // kPa

  // Design Parameters
  unbraced_length_beam: number;    // mm
  unbraced_length_column: number;  // mm
  num_frames: number;
}

// LaTeX block from backend (Handcalcs/Julia)
export interface LatexBlock {
  index: number;
  step_title: string;
  latex: string;
  category?: string;  // portal, gravity, combinations, beam_design, column_design
}

// Computed values from backend
export interface ComputedValue {
  name: string;
  value: number;
  unit?: string;
  storey?: number;
  bay?: number;
  member?: string;
}

// AISC Design result
export interface DesignCheck {
  member: string;
  section: string;
  demand: number;
  capacity: number;
  ratio: number;
  status: 'safe' | 'unsafe' | 'warning';
  check_type: string;
  description?: string;
}

// Full analysis result from /api/analyze
export interface AnalysisResult {
  latex_blocks: LatexBlock[];
  computed_values: ComputedValue[];
  design_results: {
    beams: DesignCheck[];
    columns: DesignCheck[];
  };
  summary: {
    portal_method: string;
    gravity_loads: string;
    combinations: string;
    beam_design: string;
    column_design: string;
  };
}

// Fast analysis result from /api/analyze/fast
export interface FastAnalysisResult {
  computed_values: ComputedValue[];
  summary: string;
}

// Default values (Pihuts example)
export const DEFAULT_INPUT: StructureInput = {
  num_storeys: 3,
  num_bays: 2,
  storey_heights: [4, 3, 3],
  bay_widths_abc: [6.0, 5.5],
  bay_widths_123: [7.0, 6.0],
  lateral_forces: [21.88, 38.29, 40.96],
  fy: 248,
  live_load: 2.4,
  beam_weight: 1.70,
  slab_weight: 4.0,
  wall_weight: 9.9,
  parapet_weight: 4.0,
  unbraced_length_beam: 7000,
  unbraced_length_column: 4000,
  num_frames: 3,
};
