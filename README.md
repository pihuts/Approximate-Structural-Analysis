# Portal Frame Analysis Application

A comprehensive structural engineering tool that performs portal frame analysis and design for multi-story, multi-bay steel frames. This application implements the Portal Method for lateral load analysis and includes distributed load analysis for gravity loads.

## Features

### Structural Analysis
- **Portal Method Analysis**: Calculate member forces due to lateral loads
- **Distributed Load Analysis**: Analyze gravity loads (dead and live loads)
- **Load Combination**: Combine lateral and gravity loads per AISC requirements
- **Force Diagrams**: Generate shear force, bending moment, and axial force diagrams

### Steel Design
- **AISC Section Selection**: Automatic selection of appropriate W-sections from database
- **Member Design Checks**:
  - Beam flexure and shear capacity
  - Column stability and interaction equations
  - Compact section checks
  - Slenderness ratio evaluation

### Documentation
- **Automated Calculations**: Uses handcalcs to document structural calculations
- **HTML/LaTeX Output**: Generate professional engineering calculation documentation
- **Visualization**: Plot structural diagrams with force representations
- **Screenshot Capabilities**: Automated screenshots of calculation results

## Requirements

```
contourpy==1.3.1
cycler==0.12.1
fonttools==4.57.0
joblib==1.4.2
kiwisolver==1.4.8
matplotlib==3.10.1
numpy==2.2.4
packaging==24.2
pandas==2.2.3
pillow==11.1.0
pyparsing==3.2.3
python-dateutil==2.9.0.post0
pytz==2025.2
scikit-learn==1.6.1
scipy==1.15.2
six==1.17.0
threadpoolctl==3.6.0
tzdata==2025.2
handcalcs
forallpeople
selenium
```

Additionally requires:
- Chrome WebDriver for automated screenshots
- AISC section data (Excel format)

## Installation

1. Clone the repository
2. Install the required packages:
   ```
   pip install -r requirements.txt
   ```
3. Download ChromeDriver and place it in the root directory
4. Ensure AISC section data (`1.xlsx`) is available in the root directory

## Usage

### Basic Setup

```python
from portal_method import portalmethod

# Define structure parameters
height = [4, 3, 3]  # Floor heights (m)
storey = 3
bay = 2
bay_widths = np.array([6, 5.5])  # Bay widths for frame abc (m)
bay_widths_123 = np.array([7, 6])  # Bay widths for frame 123 (m)
force_list = np.array([21.88, 38.29, 40.96])  # Lateral forces (kN)

# Initialize portal method
frame_analysis = portalmethod(
    Height=height,
    Storey=storey,
    Bay=bay,
    Bay_abc=bay_widths,
    Bay_123=bay_widths_123,
    Force_list=force_list,
    No_frames=3,
    folder_name="MyProject",
    fy=248,  # Steel yield strength (MPa)
    color="cyan"
)

# Run analyses
frame_analysis.handcalc_approximate_and_figures()
frame_analysis.handcalc_portal_and_figures()
frame_analysis.load_combination_beam()
frame_analysis.load_combination_column()
frame_analysis.beam_parameters()
frame_analysis.column_parameters()
frame_analysis.html_makerl()
frame_analysis.html_makerl1()
frame_analysis.selenium_screenshot()
```

### Output Files

The program creates a folder structure with the following components:
- `Data`: CSV files with analysis results and HTML documentation
- `Portal`: Diagrams for portal method analysis
- `Approximate_Method`: Diagrams for distributed load analysis
- `Portal_Pictures`: Screenshots of calculation results
- `Latex_Comp`: LaTeX output of calculations

## Structure Model

The application models a multi-story, multi-bay frame with the following attributes:
- Multiple stories with variable heights
- Multiple bays with variable widths
- Two perpendicular frames (abc and 123)
- Portal method for lateral load distribution
- Distributed loads for gravity analysis

## Design Process

1. **Analysis Phase**:
   - Portal method analysis for lateral loads
   - Distributed load analysis for gravity loads
   - Load combination according to design codes

2. **Design Phase**:
   - Beam selection based on moment and shear requirements
   - Column selection based on axial-flexural interaction
   - Capacity checks for all members

3. **Documentation Phase**:
   - Generate calculation documentation
   - Create structural diagrams
   - Compile final design report

## Notes

- Units are in SI (meters, kN)
- Steel design follows AISC specifications
- The application generates detailed calculation documentation for engineering review

## Future Enhancements

- P-Delta analysis capabilities
- Dynamic analysis for seismic design
- Connection design module
- Foundation design integration