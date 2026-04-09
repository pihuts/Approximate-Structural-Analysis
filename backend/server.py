"""
FastAPI backend server for the Portal Frame Analysis application.

Provides:
- POST /api/analyze: Run full portal frame analysis (with LaTeX)
- POST /api/analyze/fast: Quick analysis without LaTeX rendering
- GET  /api/health: Health check
- GET  /api/aisc-sections: AISC W-section database

Calls Julia (portal_analysis.jl) via subprocess for all calculations.
"""

import os
import sys
import json
import logging
import subprocess
import traceback
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# =============================================================================
# LOGGING
# =============================================================================

logging.basicConfig(
    level=logging.DEBUG if os.environ.get("DEBUG", "").lower() == "true" else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("portal-frame-api")

# =============================================================================
# FASTAPI APP
# =============================================================================

app = FastAPI(title="Portal Frame Analysis API", version="1.0.0")

# CORS for MUI frontend (Vite dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# LATEX SANITIZATION (borrowed from quiz project pattern)
# =============================================================================

def sanitize_latex(content: str) -> str:
    """
    Remove control characters that corrupt LaTeX rendering.

    Handcalcs.jl can produce control characters like \\x08 (backspace) and
    \\x0c (form feed) in LaTeX output. These cause KaTeX to render
    garbage or nothing.
    """
    if not content:
        return content
    return content.replace("\x08", "").replace("\x0c", "")


# =============================================================================
# REQUEST / RESPONSE MODELS
# =============================================================================

class StructureInput(BaseModel):
    """Input parameters for portal frame analysis."""
    # Structure geometry
    num_storeys: int = 3
    num_bays: int = 2
    storey_heights: list[float] = [4.0, 3.0, 3.0]       # meters (top to bottom)
    bay_widths_abc: list[float] = [6.0, 5.5]             # meters (frame ABC)
    bay_widths_123: list[float] = [7.0, 6.0]             # meters (frame 123)

    # Lateral forces (kN) per storey from top
    lateral_forces: list[float] = [21.88, 38.29, 40.96]

    # Material properties
    fy: float = 248.0          # MPa, yield strength
    steel_E: float = 200000.0  # MPa, modulus of elasticity

    # Load parameters
    live_load: float = 2.4     # kPa
    beam_weight: float = 1.70  # kN/m (39.15/23)
    slab_weight: float = 4.0   # kPa
    wall_weight: float = 9.9   # kPa
    parapet_weight: float = 4.0  # kPa

    # Frame configuration
    num_frames: int = 3
    unbraced_length_beam: float = 7000.0    # mm
    unbraced_length_column: float = 4000.0  # mm

    # Analysis options
    render_latex: bool = True
    run_design: bool = True


class AnalysisResult(BaseModel):
    """Full analysis result with LaTeX blocks, computed values, and design results."""
    success: bool
    latex_blocks: list[dict]
    computed_values: dict
    design_results: Optional[dict] = None
    diagrams: Optional[dict] = None
    error: Optional[str] = None


# =============================================================================
# JULIA INTEGRATION
# =============================================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent
JULIA_SCRIPT = PROJECT_ROOT / "julia" / "portal_analysis.jl"
JULIA_PATH = os.environ.get("JULIA_PATH", os.path.expanduser("~/bin/julia"))


def run_julia(params_dict: dict) -> dict:
    """
    Run the Julia calculation script and return parsed JSON result.

    Follows the quiz project pattern:
    - Pass JSON via stdin
    - Capture stdout (JSON result) and stderr (logs/errors)
    - Parse and return the result dict
    """
    input_json = json.dumps(params_dict)
    julia_cwd = str(JULIA_SCRIPT.parent)

    logger.info("Calling Julia: %s --project %s", JULIA_PATH, JULIA_SCRIPT)
    logger.debug("Julia input JSON: %s", input_json[:500])

    result = subprocess.run(
        [JULIA_PATH, "--project=.", str(JULIA_SCRIPT)],
        input=input_json,
        capture_output=True,
        text=True,
        timeout=120,  # 2 minutes for full analysis
        cwd=julia_cwd,
    )

    if result.stderr:
        logger.debug("Julia stderr:\n%s", result.stderr[-2000:])

    if result.returncode != 0:
        error_msg = result.stderr.strip() or f"Julia exited with code {result.returncode}"
        logger.error("Julia failed (rc=%d): %s", result.returncode, error_msg[-500:])
        raise RuntimeError(f"Julia error: {error_msg}")

    # Parse JSON from stdout
    try:
        parsed = json.loads(result.stdout.strip())
    except json.JSONDecodeError as e:
        logger.error("Julia returned invalid JSON: %s\nOutput: %s", e, result.stdout[:500])
        raise RuntimeError(f"Julia returned invalid JSON: {result.stdout[:300]}")

    return parsed


# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "julia_script_exists": JULIA_SCRIPT.exists(),
        "julia_path": JULIA_PATH,
    }


@app.post("/api/analyze", response_model=AnalysisResult)
async def analyze_structure(input_data: StructureInput):
    """
    Run full portal frame analysis.

    Sends all structure parameters to Julia, which performs:
    - Portal frame approximation (cantilever / portal method)
    - Member force calculations
    - LaTeX rendering of calculations (if render_latex=True)
    - AISC member design checks (if run_design=True)

    Returns computed values, LaTeX blocks, and design results as JSON.
    """
    try:
        params = input_data.model_dump()
        julia_result = run_julia(params)

        # Sanitize LaTeX blocks
        latex_blocks = julia_result.get("latex_blocks", [])
        for block in latex_blocks:
            if "content" in block:
                block["content"] = sanitize_latex(block["content"])
            if "latex" in block:
                block["latex"] = sanitize_latex(block["latex"])

        return AnalysisResult(
            success=True,
            latex_blocks=latex_blocks,
            computed_values=julia_result.get("computed_values", {}),
            design_results=julia_result.get("design_results"),
            diagrams=julia_result.get("diagrams"),
        )

    except subprocess.TimeoutExpired:
        logger.error("Julia analysis timed out after 120 seconds")
        return AnalysisResult(
            success=False,
            latex_blocks=[],
            computed_values={},
            error="Analysis timed out. The Julia script took too long to complete.",
        )

    except RuntimeError as e:
        return AnalysisResult(
            success=False,
            latex_blocks=[],
            computed_values={},
            error=str(e),
        )

    except Exception as e:
        logger.error("Unexpected error in analyze_structure:\n%s", traceback.format_exc())
        return AnalysisResult(
            success=False,
            latex_blocks=[],
            computed_values={},
            error=f"Internal server error: {str(e)}",
        )


@app.post("/api/analyze/fast")
async def analyze_fast(input_data: StructureInput):
    """
    Fast analysis without LaTeX rendering or design checks.

    Useful for real-time feedback in the UI while the user adjusts parameters.
    """
    params = input_data.model_dump()
    params["render_latex"] = False
    params["run_design"] = False

    try:
        result = run_julia(params)
        return {
            "success": True,
            "computed_values": result.get("computed_values", {}),
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Analysis timed out."}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/aisc-sections")
async def get_aisc_sections():
    """
    Return available AISC W-sections for reference.

    Reads from data/w_sections.csv if available.
    """
    csv_path = PROJECT_ROOT / "data" / "w_sections.csv"
    if csv_path.exists():
        try:
            import pandas as pd
            df = pd.read_csv(csv_path)
            sections = df.to_dict(orient="records")
            return {"sections": sections, "count": len(sections)}
        except Exception as e:
            logger.error("Failed to read AISC sections: %s", e)
            return {"sections": [], "count": 0, "error": str(e)}
    return {"sections": [], "count": 0, "note": "AISC section database not found at data/w_sections.csv"}


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
