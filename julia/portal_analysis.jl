# =============================================================================
# Portal Frame Analysis Module
# =============================================================================
# Migrates core structural analysis logic from Python (portalmethod class)
# to Julia, following the blueprint pattern for @handcalcs rendering,
# Unitful units, and JSON I/O.
#
# Internal units: kN (force), m (length), MPa (stress), mm (section dims)
# =============================================================================

using Unitful
using Latexify
using Handcalcs
using UnitfulLatexify
using JSON

# =============================================================================
# 1) GLOBAL RENDERING CONFIGURATION
# =============================================================================

"""
    SIG5_FMT

Shared number formatter for LaTeX output.
5 significant figures for all rendered values.
"""
const SIG5_FMT = FancyNumberFormatter(5)

"""
Configure Latexify defaults used by Handcalcs/Unitful rendering.
"""
Latexify.set_default(
    permode = :frac,
    fmt = SIG5_FMT,
)

# =============================================================================
# 2) SHARED HELPERS
# =============================================================================

"""
    _to_unit(x, u)

Normalize raw inputs into a Unitful quantity with unit `u`.
Accepts either a plain number or an already-unitful quantity.
"""
_to_unit(x::Unitful.AbstractQuantity, u) = uconvert(u, x)
_to_unit(x::Real, u) = x * u

"""
    _must_be_positive(x, name)

Validation helper for physical quantities that must be strictly positive.
"""
function _must_be_positive(x, name::AbstractString)
    x > zero(x) || throw(DomainError(x, "$name must be positive"))
    return x
end

"""
    _must_be_nonnegative(x, name)

Validation helper for values that may be zero but not negative.
"""
function _must_be_nonnegative(x, name::AbstractString)
    x >= zero(x) || throw(DomainError(x, "$name must be nonnegative"))
    return x
end

"""
    _must_be_integer_positive(x, name)

Validate and coerce a positive integer (e.g., number of stories, bays).
"""
function _must_be_integer_positive(x, name::AbstractString)
    n = Int(x)
    n > 0 || throw(DomainError(n, "$name must be a positive integer"))
    return n
end

# =============================================================================
# 3) SMART RENDER MACRO
# =============================================================================

"""
    @smartmath render_flag begin ... end [kwargs...]

Run a math block once and optionally render it through Handcalcs.

If `render_flag == true`, the block is rendered using `@handcalcs`.
If `render_flag == false`, the block still executes normally so variables
are computed without paying rendering/display overhead.
"""
macro smartmath(render_flag, math_block, kwargs...)
    render_expr = :(@handcalcs $math_block $(kwargs...))
    return esc(quote
        if $render_flag
            $render_expr
        else
            $math_block
            nothing
        end
    end)
end

# =============================================================================
# 4) TYPED SOLUTION STRUCTS
# =============================================================================

"""
    SectionProperties

AISC W-section properties.
All dimensional values in mm, S/I in mm^3/mm^4.
"""
struct SectionProperties
    name::String
    A::typeof(1.0u"mm^2")     # Cross-sectional area
    d::typeof(1.0u"mm")       # Depth
    bf::typeof(1.0u"mm")      # Flange width
    tf::typeof(1.0u"mm")      # Flange thickness
    tw::typeof(1.0u"mm")      # Web thickness
    Sx::typeof(1.0u"mm^3")    # Elastic section modulus (x-axis)
    Sy::typeof(1.0u"mm^3")    # Elastic section modulus (y-axis)
    Ix::typeof(1.0u"mm^4")    # Moment of inertia (x-axis)
    Iy::typeof(1.0u"mm^4")    # Moment of inertia (y-axis)
    rx::typeof(1.0u"mm")      # Radius of gyration (x-axis)
    ry::typeof(1.0u"mm")      # Radius of gyration (y-axis)
end

"""
    PortalShearResult

Column shears from portal method analysis.
"""
struct PortalShearResult
    shear_unit::Vector{Float64}           # Base shear unit per story (from top cumulative)
    column_shear::Matrix{Float64}         # [story, col_index] shear values
end

"""
    PortalMomentResult

Column and beam moments from portal method.
"""
struct PortalMomentResult
    column_moment::Matrix{Float64}        # [story, col_index]
    beam_moment::Matrix{Float64}          # [story, bay_index]
end

"""
    PortalShearForceResult

Beam shears from portal method.
"""
struct PortalShearForceResult
    beam_shear::Matrix{Float64}           # [story, bay_index]
end

"""
    PortalAxialResult

Column axial forces from portal method.
"""
struct PortalAxialResult
    column_axial::Matrix{Float64}         # [story, col_index]
end

"""
    DistributedLoadResult

Gravity distributed loads per beam (dead and live).
"""
struct DistributedLoadResult
    dead_load::Matrix{Float64}            # [story, bay] in kN/m
    live_load::Matrix{Float64}            # [story, bay] in kN/m
    slab_force_dead::Matrix{Float64}      # [story, bay] slab contribution
    slab_force_live::Matrix{Float64}      # [story, bay] slab contribution
end

"""
    BeamAnalysisResult

Beam bending moment and shear from approximate method.
"""
struct BeamAnalysisResult
    moment_mid::Matrix{Float64}           # [story, bay] midspan moment (kN*m)
    moment_end::Matrix{Float64}           # [story, bay] end moment (kN*m)
    shear_mid::Matrix{Float64}            # [story, bay] midspan shear (kN)
    shear_end::Matrix{Float64}            # [story, bay] end shear (kN)
end

"""
    LoadCombinationResult

Factored load combinations per AISC.
"""
struct LoadCombinationResult
    combo1_moment::Matrix{Float64}       # Dead + Live
    combo1_shear::Matrix{Float64}
    combo2_moment::Matrix{Float64}       # Dead + 0.7*Earthquake
    combo2_shear::Matrix{Float64}
    combo3_moment::Matrix{Float64}       # Dead + 0.75*Live + 0.525*Earthquake
    combo3_shear::Matrix{Float64}
    combo_axial::Matrix{Float64}         # Column axial from combos
    combo_col_moment::Matrix{Float64}    # Column moment from combos
end

"""
    BeamDesignResult

AISC beam design checks.
"""
struct BeamDesignResult
    Sx_required::Float64                  # Required section modulus (mm^3)
    section::SectionProperties            # Selected section
    compact_flange::Bool
    compact_web::Bool
    ltb_case::Int                         # 1, 2, or 3
    fb_allowable::Float64                 # Allowable bending stress (MPa)
    fb_actual::Float64                    # Actual bending stress (MPa)
    fv_allowable::Float64                 # Allowable shear stress (MPa)
    fv_actual::Float64                    # Actual shear stress (MPa)
    bending_safe::Bool
    shear_safe::Bool
end

"""
    ColumnDesignResult

AISC column design checks.
"""
struct ColumnDesignResult
    K::Float64                            # Effective length factor
    slenderness_ratio::Float64            # KL/r
    Cc::Float64                           # Euler slenderness limit
    is_short::Bool                        # true if KL/r < Cc
    Fa::Float64                           # Allowable axial stress (MPa)
    fa::Float64                           # Actual axial stress (MPa)
    Fb::Float64                           # Allowable bending stress (MPa)
    fb::Float64                           # Actual bending stress (MPa)
    magnification_factor::Float64         # Cm / (1 - fa/Fe)
    stability_ratio::Float64              # fa/Fa + mag*(fb/Fb)
    strength_ratio::Float64               # fa/(0.6*Fy) + fb/Fb
    stability_safe::Bool
    strength_safe::Bool
    section::SectionProperties
end

# =============================================================================
# 5) PORTAL METHOD SOLVERS (Lateral Load Analysis)
# =============================================================================

"""
    solve_portal_column_shear(force_list, bay_count)

Portal method shear distribution.
- `force_list`: lateral forces per story (top to bottom ordering in Python;
  this function expects bottom-to-top as stored)
- `bay_count`: number of bays

Returns `PortalShearResult` with column shears per story.
Exterior columns get shear_unit; interior columns get 2*shear_unit.
"""
function solve_portal_column_shear(force_list, bay_count; render=false)
    n_stories = length(force_list)
    # Cumulative sum from top: reverse the list, cumsum, reverse back
    cumulative_top = reverse(cumsum(reverse(force_list)))
    shear_unit = cumulative_top ./ (bay_count * 2)

    # Column shear matrix: [story, col_index], bay_count+1 columns
    col_shear = zeros(n_stories, bay_count + 1)
    for i in 1:n_stories
        for j in 1:(bay_count + 1)
            if j == 1 || j == bay_count + 1
                col_shear[i, j] = round(shear_unit[i], digits=2)
            else
                col_shear[i, j] = round(shear_unit[i] * 2, digits=2)
            end
        end
    end

    latex = @smartmath render begin
        n_stories; "Number of stories";
        bay_count; "Number of bays";
        shear_unit; "Shear unit per story (from top cumulative)";
        col_shear; "Column shear matrix [story, col]";
    end cols=3 len=:long permode=:frac fmt=SIG5_FMT

    return (;
        result = PortalShearResult(shear_unit, col_shear),
        latex,
    )
end

"""
    solve_portal_column_moment(column_shear, column_height)

Portal method column moment: M = V * h / 2 (fixed base, inflection at mid-height).
- `column_shear`: Matrix [story, col]
- `column_height`: height of each story (scalar or vector)
"""
function solve_portal_column_moment(column_shear, column_height; render=false)
    n_stories, n_cols = size(column_shear)
    heights = column_height isa Real ? fill(Float64(column_height), n_stories) : collect(Float64, column_height)

    col_moment = zeros(n_stories, n_cols)
    for i in 1:n_stories
        for j in 1:n_cols
            # Python uses reversed indexing: csf[::-1][i, j] * height / 2
            col_moment[i, j] = round(column_shear[i, j] * heights[i] / 2, digits=2)
        end
    end

    latex = @smartmath render begin
        column_shear; "Column shear forces";
        heights; "Story heights";
        col_moment; "Column moments = V * h / 2";
    end cols=3 len=:long permode=:frac fmt=SIG5_FMT

    return (;
        result = PortalMomentResult(col_moment, zeros(n_stories, n_cols - 1)),
        latex,
    )
end

"""
    solve_portal_beam_moment(col_moment, n_stories)

Portal method beam moment: sum of adjacent column moments.
For interior stories: beam_moment = col_moment[story, col] + col_moment[story+1, col]
For top story: beam_moment = col_moment[story, col] only.
"""
function solve_portal_beam_moment(col_moment; render=false)
    n_stories, n_cols = size(col_moment)
    n_bays = n_cols - 1
    beam_moment = zeros(n_stories, n_bays)

    for i in 1:n_stories
        for j in 1:n_bays
            if i < n_stories
                bm = col_moment[i, j] + col_moment[i + 1, j]
            else
                bm = col_moment[i, j]
            end
            beam_moment[i, j] = round(bm, digits=2)
        end
    end

    latex = @smartmath render begin
        col_moment; "Column moments";
        beam_moment; "Beam moments = sum of adjacent column moments";
    end cols=3 len=:long permode=:frac fmt=SIG5_FMT

    return (;
        result = PortalMomentResult(col_moment, beam_moment),
        latex,
    )
end

"""
    solve_portal_beam_shear(beam_moment, bay_widths)

Portal method beam shear: V = M / (L/2) = 2M / L.
"""
function solve_portal_beam_shear(beam_moment, bay_widths; render=false)
    n_stories, n_bays = size(beam_moment)
    beam_shear = zeros(n_stories, n_bays)

    for i in 1:n_stories
        for j in 1:n_bays
            beam_shear[i, j] = round(beam_moment[i, j] / (bay_widths[j] * 0.5), digits=2)
        end
    end

    latex = @smartmath render begin
        beam_moment; "Beam moments";
        bay_widths; "Bay widths";
        beam_shear; "Beam shears = 2M / L";
    end cols=3 len=:long permode=:frac fmt=SIG5_FMT

    return (;
        result = PortalShearForceResult(beam_shear),
        latex,
    )
end

"""
    solve_portal_column_axial(beam_shear)

Portal method column axial: cumulative sum of beam shears from current story to top.
- Exterior columns: accumulate shear from adjacent bay
- Interior columns: accumulate difference of adjacent bay shears
"""
function solve_portal_column_axial(beam_shear; render=false)
    n_stories, n_bays = size(beam_shear)
    n_cols = n_bays + 1
    col_axial = zeros(n_stories, n_cols)

    for i in 1:n_stories
        for j in 1:n_cols
            axial = 0.0
            for i_ in i:n_stories
                if j == 1
                    axial += beam_shear[i_, j]
                elseif j == n_cols
                    axial += beam_shear[i_, j - 1]
                else
                    axial += beam_shear[i_, j - 1] - beam_shear[i_, j]
                end
            end
            col_axial[i, j] = round(axial, digits=2)
        end
    end

    latex = @smartmath render begin
        beam_shear; "Beam shears";
        col_axial; "Column axial forces (cumulative from top)";
    end cols=3 len=:long permode=:frac fmt=SIG5_FMT

    return (;
        result = PortalAxialResult(col_axial),
        latex,
    )
end

# =============================================================================
# 6) DISTRIBUTED LOAD ANALYSIS (Gravity)
# =============================================================================

"""
    solve_distributed_loads(params)

Compute dead/live distributed loads per beam.

Parameters (Dict keys):
- beam_weight: kN/m self-weight of beam
- slab_weight: kN/m^2 slab load
- wall_weight: kN/m wall weight on exterior frames
- parapet_weight: kN/m parapet on top story
- live_load: kN/m^2 live load
- bay_widths: array of bay widths (m)
- n_stories: number of stories
- tributary_width: tributary width for slab (m)

Returns DistributedLoadResult.
"""
function solve_distributed_loads(; beam_weight, slab_weight, wall_weight,
    parapet_weight, live_load, bay_widths, n_stories, tributary_width,
    render=false)

    n_bays = length(bay_widths)
    dead_load = zeros(n_stories, n_bays)
    live_loads = zeros(n_stories, n_bays)
    slab_force_dead = zeros(n_stories, n_bays)
    slab_force_live = zeros(n_stories, n_bays)

    for i in 1:n_stories
        for j in 1:n_bays
            # Slab force = bay_width * tributary_width * load / 4
            slab_fd = round(bay_widths[j] * tributary_width * slab_weight / 4, digits=2)
            slab_fl = round(bay_widths[j] * tributary_width * live_load / 4, digits=2)
            slab_force_dead[i, j] = slab_fd
            slab_force_live[i, j] = slab_fl

            # Dead: beam_w + wall_w (or parapet for top) + slab_force
            if i == n_stories
                # Top story uses parapet instead of wall
                w_dead = round(beam_weight + parapet_weight + slab_fd, digits=2)
            else
                w_dead = round(beam_weight + wall_weight + slab_fd, digits=2)
            end
            dead_load[i, j] = w_dead

            # Live: slab force only
            live_loads[i, j] = round(slab_fl, digits=2)
        end
    end

    latex = @smartmath render begin
        beam_weight; "Beam self-weight (kN/m)";
        slab_weight; "Slab load (kN/m^2)";
        wall_weight; "Wall weight (kN/m)";
        parapet_weight; "Parapet weight (kN/m)";
        live_load; "Live load (kN/m^2)";
        tributary_width; "Tributary width (m)";
        dead_load; "Total dead distributed load per beam (kN/m)";
        live_loads; "Total live distributed load per beam (kN/m)";
    end cols=3 len=:long permode=:frac fmt=SIG5_FMT

    return (;
        result = DistributedLoadResult(dead_load, live_loads, slab_force_dead, slab_force_live),
        latex,
    )
end

# =============================================================================
# 7) BEAM ANALYSIS (Approximate Method)
# =============================================================================

"""
    solve_beam_moment(w, L)

Approximate beam moment using 0.8L clear span method.
- `w`: distributed load (kN/m)
- `L`: beam span (m)

Returns (midspan_moment, end_moment) in kN*m.
"""
function solve_beam_moment(w, L; render=false)
    # M_mid = w * (0.8L)^2 / 8
    M_mid = w * (0.8 * L)^2 / 8
    # End moment from cantilever action: V_ss * 0.1L + w*(0.1L)^2/2
    V_ss = w * (0.8 * L) / 2
    M_end = V_ss * (0.1 * L) + w * (0.1 * L)^2 / 2

    latex = @smartmath render begin
        w; "Distributed load (kN/m)";
        L; "Beam span (m)";
        M_mid = w * (0.8 * L)^2 / 8; "Midspan positive moment (kN*m)";
        V_ss = w * (0.8 * L) / 2; "Simple span shear at support";
        M_end = V_ss * (0.1 * L) + w * (0.1 * L)^2 / 2; "End moment (kN*m)";
    end len=:long permode=:frac fmt=SIG5_FMT

    return (;
        M_mid = round(M_mid, digits=2),
        M_end = round(M_end, digits=2),
        V_ss = round(V_ss, digits=2),
        latex,
    )
end

"""
    solve_beam_shear(w, L)

Approximate beam shear using 0.8L clear span method.
- V_mid = w * 0.8L / 2
- V_end = V_mid + w * 0.1L
"""
function solve_beam_shear(w, L; render=false)
    V_mid = w * (0.8 * L) / 2
    V_end = V_mid + w * 0.1 * L

    latex = @smartmath render begin
        w; "Distributed load (kN/m)";
        L; "Beam span (m)";
        V_mid = w * (0.8 * L) / 2; "Midspan shear (kN)";
        V_end = V_mid + w * 0.1 * L; "End shear (kN)";
    end len=:long permode=:frac fmt=SIG5_FMT

    return (;
        V_mid = round(V_mid, digits=2),
        V_end = round(V_end, digits=2),
        latex,
    )
end

"""
    solve_all_beams(dead_load, live_load, bay_widths)

Run beam moment/shear analysis for all stories and bays.
Returns BeamAnalysisResult with matrices.
"""
function solve_all_beams(dead_load, live_load, bay_widths; render=false)
    n_stories, n_bays = size(dead_load)
    moment_mid = zeros(n_stories, n_bays)
    moment_end = zeros(n_stories, n_bays)
    shear_mid = zeros(n_stories, n_bays)
    shear_end = zeros(n_stories, n_bays)

    for i in 1:n_stories
        for j in 1:n_bays
            # Dead load analysis
            md = solve_beam_moment(dead_load[i, j], bay_widths[j]; render=false)
            sd = solve_beam_shear(dead_load[i, j], bay_widths[j]; render=false)
            # Live load analysis
            ml = solve_beam_moment(live_load[i, j], bay_widths[j]; render=false)
            sl = solve_beam_shear(live_load[i, j], bay_widths[j]; render=false)

            moment_mid[i, j] = md.M_mid
            moment_end[i, j] = md.M_end
            shear_mid[i, j] = sd.V_mid
            shear_end[i, j] = sd.V_end
        end
    end

    latex = @smartmath render begin
        dead_load; "Dead load matrix (kN/m)";
        live_load; "Live load matrix (kN/m)";
        moment_mid; "Midspan moments (kN*m)";
        moment_end; "End moments (kN*m)";
        shear_end; "End shears (kN)";
    end cols=3 len=:long permode=:frac fmt=SIG5_FMT

    return (;
        result = BeamAnalysisResult(moment_mid, moment_end, shear_mid, shear_end),
        latex,
    )
end

# =============================================================================
# 8) LOAD COMBINATIONS (per AISC)
# =============================================================================

"""
    solve_load_combinations(dead, live, earthquake)

Compute AISC load combinations:
- Combo1 = Dead + Live
- Combo2 = Dead + 0.7*Earthquake
- Combo3 = Dead + 0.75*Live + 0.75*(0.7*Earthquake)

Each argument is a matrix [story, bay] or [story, col].
Returns the maximum of all three combos per member.
"""
function solve_load_combinations(dead_moment, live_moment, eq_moment,
    dead_shear, live_shear, eq_shear,
    dead_axial, live_axial, eq_axial,
    dead_col_moment, live_col_moment, eq_col_moment;
    render=false)

    n_stories_d, n_bays = size(dead_moment)
    n_stories_a, n_cols = size(dead_axial)

    combo1_m = zeros(n_stories_d, n_bays)
    combo2_m = zeros(n_stories_d, n_bays)
    combo3_m = zeros(n_stories_d, n_bays)
    combo1_s = zeros(n_stories_d, n_bays)
    combo2_s = zeros(n_stories_d, n_bays)
    combo3_s = zeros(n_stories_d, n_bays)

    for i in 1:n_stories_d
        for j in 1:n_bays
            c1m = dead_moment[i, j] + live_moment[i, j]
            c2m = dead_moment[i, j] + 0.7 * eq_moment[i, j]
            c3m = dead_moment[i, j] + 0.75 * live_moment[i, j] + 0.525 * eq_moment[i, j]
            combo1_m[i, j] = round(max(abs(c1m), abs(c2m), abs(c3m)), digits=2)

            c1s = dead_shear[i, j] + live_shear[i, j]
            c2s = dead_shear[i, j] + 0.7 * eq_shear[i, j]
            c3s = dead_shear[i, j] + 0.75 * live_shear[i, j] + 0.525 * eq_shear[i, j]
            combo1_s[i, j] = round(max(abs(c1s), abs(c2s), abs(c3s)), digits=2)
        end
    end

    # Column load combinations
    combo_axial = zeros(n_stories_a, n_cols)
    combo_col_moment = zeros(n_stories_a, n_cols)

    for i in 1:n_stories_a
        for j in 1:n_cols
            c1a = dead_axial[i, j] + live_axial[i, j]
            c2a = dead_axial[i, j] + 0.7 * eq_axial[i, j]
            c3a = dead_axial[i, j] + 0.75 * live_axial[i, j] + 0.525 * eq_axial[i, j]
            combo_axial[i, j] = round(max(abs(c1a), abs(c2a), abs(c3a)), digits=2)

            c1cm = dead_col_moment[i, j] + live_col_moment[i, j]
            c2cm = dead_col_moment[i, j] + 0.7 * eq_col_moment[i, j]
            c3cm = dead_col_moment[i, j] + 0.75 * live_col_moment[i, j] + 0.525 * eq_col_moment[i, j]
            combo_col_moment[i, j] = round(max(abs(c1cm), abs(c2cm), abs(c3cm)), digits=2)
        end
    end

    latex = @smartmath render begin
        combo1_m; "Load Combo 1 beam moment: D+L (max abs)";
        combo2_m; "Load Combo 2 beam moment: D+0.7E (max abs)";
        combo3_m; "Load Combo 3 beam moment: D+0.75L+0.525E (max abs)";
        combo_axial; "Column axial (max of all combos)";
        combo_col_moment; "Column moment (max of all combos)";
    end cols=3 len=:long permode=:frac fmt=SIG5_FMT

    return (;
        result = LoadCombinationResult(combo1_m, combo1_s, combo2_m, combo2_s,
            combo3_m, combo3_s, combo_axial, combo_col_moment),
        latex,
    )
end

# =============================================================================
# 9) AISC BEAM DESIGN CHECKS
# =============================================================================

"""
    make_section_props(name, A, d, bf, tf, tw, Sx, Sy, Ix, Iy, rx, ry)

Construct a SectionProperties struct from raw numeric values (all in mm units).
"""
function make_section_props(name, A, d, bf, tf, tw, Sx, Sy, Ix, Iy, rx, ry)
    return SectionProperties(
        name,
        A * u"mm^2",
        d * u"mm",
        bf * u"mm",
        tf * u"mm",
        tw * u"mm",
        Sx * u"mm^3",
        Sy * u"mm^3",
        Ix * u"mm^4",
        Iy * u"mm^4",
        rx * u"mm",
        ry * u"mm",
    )
end

"""
    solve_beam_design(Fy, Mu, Vu, Lb, section)

AISC beam design checks for a given section.

Arguments:
- Fy: yield strength (MPa)
- Mu: maximum factored moment (kN*m)
- Vu: maximum factored shear (kN)
- Lb: unbraced length (mm)
- section: SectionProperties

Returns BeamDesignResult.
"""
function solve_beam_design(Fy, Mu, Vu, Lb, section; render=false)
    # Extract numeric values (strip units for computations in consistent units)
    d = ustrip(u"mm", section.d)
    bf = ustrip(u"mm", section.bf)
    tf = ustrip(u"mm", section.tf)
    tw = ustrip(u"mm", section.tw)
    Sx = ustrip(u"mm^3", section.Sx)
    Ix = ustrip(u"mm^4", section.Ix)
    A = ustrip(u"mm^2", section.A)

    # Convert Mu from kN*m to N*mm for consistent units with mm^3
    Mu_Nmm = Mu * 1e6  # kN*m -> N*mm
    Vu_N = Vu * 1e3    # kN -> N

    # Required section modulus
    Sx_req = Mu_Nmm / (0.66 * Fy)  # mm^3

    # Compact section checks (AISC)
    flange_check = bf / (2 * tf)
    web_check = d / tw
    compact_flange = flange_check < 170 / sqrt(Fy)
    compact_web = web_check < 1680 / sqrt(Fy)

    # Lateral torsional buckling case
    lc = min(200 * bf / sqrt(Fy), 137900 / ((Fy * d) / (bf * tf)))
    lu = max(200 * bf / sqrt(Fy), 137900 / ((Fy * d) / (bf * tf)))

    if Lb < lc
        ltb_case = 1
        Fb = 0.66 * Fy
    elseif Lb <= lu
        ltb_case = 2
        Fb = 0.60 * Fy
    else
        ltb_case = 3
        # Case 3: reduced Fb
        cb = 1.0
        I_approx = ((1 / 6 * d) * tw^3) / 12 + (bf^3 * tf) / 12
        rt = sqrt(I_approx / A) * 1.0  # mm
        SR = Lb / rt
        l1 = min(sqrt(703270 * cb / Fy), sqrt(3516330 * cb / Fy))
        l2 = max(sqrt(703270 * cb / Fy), sqrt(3516330 * cb / Fy))

        if l1 <= SR <= l2
            Fb = max(Fy * (2/3 - Fy * SR^2 / (10.55e6 * cb)),
                     82740 * cb / ((Lb * d) / (bf * tf)))
        else
            Fb = max(1172100 * cb / SR^2,
                     82740 * cb / ((Lb * d) / (bf * tf)))
        end
    end

    # Actual bending stress
    fb_actual = Mu_Nmm / Sx  # MPa

    # Shear check
    if d / tw <= 998 / sqrt(Fy)
        Fv = 0.4 * Fy
    else
        Fv = 0.4 * Fy  # Python code uses same value for both branches
    end

    # Actual shear stress: fv = V*Q/(I*tw)
    Q = tf * bf * (d / 2)  # First moment of area (mm^3)
    fv_actual = (Vu_N * Q) / (Ix * tw)  # MPa

    bending_safe = fb_actual <= Fb
    shear_safe = fv_actual <= Fv

    latex = @smartmath render begin
        Sx_req; "Required section modulus (mm^3)";
        flange_check = bf / (2 * tf); "Flange width-thickness ratio";
        170 / sqrt(Fy); "Flange compact limit";
        web_check = d / tw; "Web depth-thickness ratio";
        1680 / sqrt(Fy); "Web compact limit";
        ltb_case; "Lateral torsional buckling case";
        Fb; "Allowable bending stress Fb (MPa)";
        fb_actual = Mu_Nmm / Sx; "Actual bending stress fb (MPa)";
        Fv; "Allowable shear stress Fv (MPa)";
        fv_actual = (Vu_N * Q) / (Ix * tw); "Actual shear stress fv (MPa)";
    end len=:long permode=:frac fmt=SIG5_FMT

    return (;
        result = BeamDesignResult(
            round(Sx_req, digits=1), section,
            compact_flange, compact_web, ltb_case,
            round(Fb, digits=2), round(fb_actual, digits=2),
            round(Fv, digits=2), round(fv_actual, digits=2),
            bending_safe, shear_safe,
        ),
        latex,
    )
end

# =============================================================================
# 10) AISC COLUMN DESIGN CHECKS
# =============================================================================

"""
    solve_k_factor(I_col, L_col, I_beam, L_beam)

Compute effective length factor K using the alignment chart method.

G = Σ(EI/L) for columns / Σ(EI/L) for beams at a joint.
For fixed base: G_a = 1.0 (practical assumption for pinned base with footing).

Solves the alignment chart equation iteratively:
  ((Gd*Ga*(π/K)^2 - 36) / (6*(Gd+Ga))) - (π/K)/tan(π/K) = 0
"""
function solve_k_factor(I_col, L_col, I_beam, L_beam; render=false)
    # G_d = (I_col/L_col_top + I_col/L_col_bot) / (I_beam/L_beam_left + I_beam/L_beam_right)
    # Simplified: two columns same section, two beams same section
    col_stiffness_top = I_col / L_col
    col_stiffness_bot = I_col / L_col
    beam_stiffness_left = I_beam / L_beam
    beam_stiffness_right = I_beam / L_beam

    G_d = (col_stiffness_top + col_stiffness_bot) / (beam_stiffness_left + beam_stiffness_right)
    G_a = 1.0  # Fixed base assumption

    # Iterative solution for K from alignment chart
    K = 1.0
    for k_trial in 0.5:0.01:3.0
        num = (G_d * G_a * (pi / k_trial)^2 - 36)
        denom = 6 * (G_d + G_a)
        x = num / denom - (pi / k_trial) / tan(pi / k_trial)
        if 0 < x < 0.1
            K = k_trial
            break
        end
    end

    latex = @smartmath render begin
        G_d; "Stiffness ratio at top joint";
        G_a; "Stiffness ratio at base (fixed = 1.0)";
        K; "Effective length factor from alignment chart";
    end len=:long permode=:frac fmt=SIG5_FMT

    return (;
        K = round(K, digits=2),
        G_d = round(G_d, digits=4),
        G_a,
        latex,
    )
end

"""
    solve_column_design(Fy, Pu, Mu, L, section, beam_Ix, beam_L; Cm=0.85)

AISC column design checks.

Arguments:
- Fy: yield strength (MPa)
- Pu: factored axial load (kN)
- Mu: factored moment (kN*m)
- L: column height (mm)
- section: SectionProperties
- beam_Ix: beam moment of inertia (mm^4)
- beam_L: beam span (mm)
- Cm: equivalent moment factor (default 0.85)

Returns ColumnDesignResult.
"""
function solve_column_design(Fy, Pu, Mu, L, section, beam_Ix, beam_L; Cm=0.85, render=false)
    d = ustrip(u"mm", section.d)
    bf = ustrip(u"mm", section.bf)
    tf = ustrip(u"mm", section.tf)
    tw = ustrip(u"mm", section.tw)
    Sx = ustrip(u"mm^3", section.Sx)
    Ix = ustrip(u"mm^4", section.Ix)
    A = ustrip(u"mm^2", section.A)
    rx = ustrip(u"mm", section.rx)
    ry = ustrip(u"mm", section.ry)

    Pu_N = Pu * 1e3       # kN -> N
    Mu_Nmm = Mu * 1e6     # kN*m -> N*mm
    E = 200000.0           # MPa (steel modulus)

    # K factor from alignment chart
    k_data = solve_k_factor(Ix, L, beam_Ix, beam_L; render=false)
    K = k_data.K
    G_d = k_data.G_d

    # Slenderness check
    SR_x = K * L / rx
    SR_y = K * L / ry
    SR = max(SR_x, SR_y)

    Cc = sqrt(2 * pi^2 * E / Fy)
    is_short = SR < Cc

    # Allowable axial stress Fa (AISC E2)
    if is_short
        Fs = 5/3 + (3 * SR) / (8 * Cc) - SR^3 / (8 * Cc^3)
        Fa = (1 - (SR / (2 * Cc))^2) * (Fy / Fs)
    else
        Fa = 12 * pi^2 * E / (23 * SR^2)
    end

    # Actual stresses
    fa = Pu_N / A  # MPa
    fb = Mu_Nmm / Sx  # MPa

    # Euler buckling stress for magnification factor
    Fe = 12 * pi^2 * E / (23 * SR^2)

    # Magnification factor
    mag = Cm / (1 - fa / Fe)
    mag = mag < 1.0 ? mag : 1.0  # Cap at 1.0 per Python code

    # LTB case for Fb
    lc = min(200 * bf / sqrt(Fy), 137900 / ((Fy * d) / (bf * tf)))
    lu = max(200 * bf / sqrt(Fy), 137900 / ((Fy * d) / (bf * tf)))
    Lb = L  # Unbraced length = column height

    if Lb < lc
        Fb = 0.66 * Fy
    elseif Lb <= lu
        Fb = 0.60 * Fy
    else
        cb = 1.0
        I_approx = ((1 / 6 * d) * tw^3) / 12 + (bf^3 * tf) / 12
        rt = sqrt(I_approx / A)
        SR_ltb = Lb / rt
        l1 = min(sqrt(703270 * cb / Fy), sqrt(3516330 * cb / Fy))
        l2 = max(sqrt(703270 * cb / Fy), sqrt(3516330 * cb / Fy))
        if l1 <= SR_ltb <= l2
            Fb = max(Fy * (2/3 - Fy * SR_ltb^2 / (10.55e6 * cb)),
                     82740 * cb / ((Lb * d) / (bf * tf)))
        else
            Fb = max(1172100 * cb / SR_ltb^2,
                     82740 * cb / ((Lb * d) / (bf * tf)))
        end
    end

    # Interaction equations
    stability_ratio = fa / Fa + mag * (fb / Fb)
    strength_ratio = fa / (0.6 * Fy) + fb / Fb

    stability_safe = stability_ratio <= 1.0
    strength_safe = strength_ratio <= 1.0

    latex = @smartmath render begin
        K; "Effective length factor";
        SR; "Maximum slenderness ratio KL/r";
        Cc; "Euler slenderness limit";
        is_short; "Column is short (KL/r < Cc)";
        Fa; "Allowable axial stress (MPa)";
        fa = Pu_N / A; "Actual axial stress (MPa)";
        Fe; "Euler buckling stress (MPa)";
        mag = Cm / (1 - fa / Fe); "Magnification factor Cm/(1-fa/Fe)";
        Fb; "Allowable bending stress (MPa)";
        fb = Mu_Nmm / Sx; "Actual bending stress (MPa)";
        stability_ratio = fa / Fa + mag * (fb / Fb); "Stability interaction ratio";
        strength_ratio = fa / (0.6 * Fy) + fb / Fb; "Strength interaction ratio";
    end len=:long permode=:frac fmt=SIG5_FMT

    return (;
        result = ColumnDesignResult(
            K, round(SR, digits=2), round(Cc, digits=2), is_short,
            round(Fa, digits=2), round(fa, digits=2),
            round(Fb, digits=2), round(fb, digits=2),
            round(mag, digits=4),
            round(stability_ratio, digits=4), round(strength_ratio, digits=4),
            stability_safe, strength_safe,
            section,
        ),
        latex,
    )
end

# =============================================================================
# 11) BOUNDARY FUNCTION (validation/normalization)
# =============================================================================

"""
    solve_portal_frame(params)

Boundary function that validates/normalizes all inputs and runs the full
portal frame analysis pipeline.

Expected params Dict keys:
- height: story height (m) - scalar or array
- n_stories: number of stories
- bay_count: number of bays
- bay_widths: array of bay widths (m)
- force_list: array of lateral forces per story (kN), bottom to top
- beam_weight: beam self-weight (kN/m)
- slab_weight: slab load (kN/m^2)
- wall_weight: wall weight (kN/m)
- parapet_weight: parapet weight (kN/m)
- live_load_value: live load (kN/m^2)
- tributary_width: tributary width for slab (m)
- Fy: yield strength (MPa)
- Lb_beam: unbraced length for beam (mm)
- L_column: column height for design (mm)
- beam_section: Dict with section properties (or nothing for auto-select)
- column_section: Dict with section properties (or nothing for auto-select)
"""
function solve_portal_frame(params; render=false)
    latex_blocks = []
    block_idx = 1

    # -------------------------------------------------------------------------
    # Boundary: validate and normalize inputs
    # -------------------------------------------------------------------------
    n_stories = _must_be_integer_positive(params["n_stories"], "n_stories")
    bay_count = _must_be_integer_positive(params["bay_count"], "bay_count")
    Fy = _must_be_positive(Float64(params["Fy"]), "Fy")

    heights = let h = params["height"]
        h isa AbstractVector ? Float64.(h) : fill(Float64(h), n_stories)
    end
    bay_widths = Float64.(params["bay_widths"])
    force_list = Float64.(params["force_list"])

    @assert length(bay_widths) == bay_count "bay_widths length must equal bay_count"
    @assert length(force_list) == n_stories "force_list length must equal n_stories"

    beam_weight = Float64(params["beam_weight"])
    slab_weight = Float64(params["slab_weight"])
    wall_weight = Float64(params["wall_weight"])
    parapet_weight = Float64(params["parapet_weight"])
    live_load_value = Float64(params["live_load_value"])
    tributary_width = Float64(params["tributary_width"])
    Lb_beam = Float64(params["Lb_beam"])
    L_column = Float64(params["L_column"])

    # -------------------------------------------------------------------------
    # Stage A: Portal Method (Lateral Load Analysis)
    # -------------------------------------------------------------------------
    portal_shear = solve_portal_column_shear(force_list, bay_count; render=render)
    if render && portal_shear.latex !== nothing
        push!(latex_blocks, Dict("index" => block_idx, "step_title" => "Portal Method - Column Shear", "latex" => string(portal_shear.latex)))
        block_idx += 1
    end

    portal_moment = solve_portal_column_moment(portal_shear.result.column_shear, heights; render=render)
    if render && portal_moment.latex !== nothing
        push!(latex_blocks, Dict("index" => block_idx, "step_title" => "Portal Method - Column Moment", "latex" => string(portal_moment.latex)))
        block_idx += 1
    end

    portal_beam = solve_portal_beam_moment(portal_moment.result.column_moment; render=render)
    if render && portal_beam.latex !== nothing
        push!(latex_blocks, Dict("index" => block_idx, "step_title" => "Portal Method - Beam Moment", "latex" => string(portal_beam.latex)))
        block_idx += 1
    end

    portal_bshear = solve_portal_beam_shear(portal_beam.result.beam_moment, bay_widths; render=render)
    if render && portal_bshear.latex !== nothing
        push!(latex_blocks, Dict("index" => block_idx, "step_title" => "Portal Method - Beam Shear", "latex" => string(portal_bshear.latex)))
        block_idx += 1
    end

    portal_axial = solve_portal_column_axial(portal_bshear.result.beam_shear; render=render)
    if render && portal_axial.latex !== nothing
        push!(latex_blocks, Dict("index" => block_idx, "step_title" => "Portal Method - Column Axial", "latex" => string(portal_axial.latex)))
        block_idx += 1
    end

    # -------------------------------------------------------------------------
    # Stage B: Distributed Load Analysis (Gravity)
    # -------------------------------------------------------------------------
    dist = solve_distributed_loads(
        beam_weight=beam_weight, slab_weight=slab_weight,
        wall_weight=wall_weight, parapet_weight=parapet_weight,
        live_load=live_load_value, bay_widths=bay_widths,
        n_stories=n_stories, tributary_width=tributary_width,
        render=render,
    )
    if render && dist.latex !== nothing
        push!(latex_blocks, Dict("index" => block_idx, "step_title" => "Distributed Loads", "latex" => string(dist.latex)))
        block_idx += 1
    end

    # -------------------------------------------------------------------------
    # Stage C: Beam Analysis
    # -------------------------------------------------------------------------
    beam_analysis = solve_all_beams(
        dist.result.dead_load, dist.result.live_load, bay_widths; render=render,
    )
    if render && beam_analysis.latex !== nothing
        push!(latex_blocks, Dict("index" => block_idx, "step_title" => "Beam Moment and Shear", "latex" => string(beam_analysis.latex)))
        block_idx += 1
    end

    # -------------------------------------------------------------------------
    # Stage D: Load Combinations
    # -------------------------------------------------------------------------
    # Build earthquake effect matrices from portal results
    eq_moment = portal_beam.result.beam_moment
    eq_shear = portal_bshear.result.beam_shear
    eq_axial = portal_axial.result.column_axial
    eq_col_moment = portal_moment.result.column_moment

    # Gravity dead/live for columns: cumulative beam shears
    dead_gravity_axial = zeros(n_stories, bay_count + 1)
    live_gravity_axial = zeros(n_stories, bay_count + 1)
    dead_col_moment_gravity = zeros(n_stories, bay_count + 1)
    live_col_moment_gravity = zeros(n_stories, bay_count + 1)

    for i in 1:n_stories
        for j in 1:(bay_count + 1)
            # Axial from gravity: cumulative beam end shears
            axial_d = 0.0
            axial_l = 0.0
            for i_ in i:n_stories
                if j == 1
                    axial_d += beam_analysis.result.shear_end[i_, 1]
                    axial_l += beam_analysis.result.shear_end[i_, 1] * (dist.result.live_load[i_, 1] / max(dist.result.dead_load[i_, 1], 1e-10))
                elseif j == bay_count + 1
                    axial_d += beam_analysis.result.shear_end[i_, bay_count]
                    axial_l += beam_analysis.result.shear_end[i_, bay_count] * (dist.result.live_load[i_, bay_count] / max(dist.result.dead_load[i_, bay_count], 1e-10))
                else
                    axial_d += beam_analysis.result.shear_end[i_, j-1] + beam_analysis.result.shear_end[i_, j]
                    axial_l += beam_analysis.result.shear_end[i_, j-1] * (dist.result.live_load[i_, j-1] / max(dist.result.dead_load[i_, j-1], 1e-10)) +
                               beam_analysis.result.shear_end[i_, j] * (dist.result.live_load[i_, j] / max(dist.result.dead_load[i_, j], 1e-10))
                end
            end
            dead_gravity_axial[i, j] = round(axial_d, digits=2)
            live_gravity_axial[i, j] = round(axial_l, digits=2)
        end
    end

    combos = solve_load_combinations(
        beam_analysis.result.moment_end, beam_analysis.result.moment_end .* 0.5, eq_moment,
        beam_analysis.result.shear_end, beam_analysis.result.shear_end .* 0.5, eq_shear,
        dead_gravity_axial, live_gravity_axial, eq_axial,
        dead_col_moment_gravity, live_col_moment_gravity, eq_col_moment;
        render=render,
    )
    if render && combos.latex !== nothing
        push!(latex_blocks, Dict("index" => block_idx, "step_title" => "Load Combinations", "latex" => string(combos.latex)))
        block_idx += 1
    end

    # -------------------------------------------------------------------------
    # Stage E: Design Checks (if section provided)
    # -------------------------------------------------------------------------
    max_beam_moment = maximum(combos.result.combo1_moment)
    max_beam_shear = maximum(combos.result.combo1_shear)
    max_col_axial = maximum(combos.result.combo_axial)
    max_col_moment = maximum(combos.result.combo_col_moment)

    beam_design_result = nothing
    column_design_result = nothing

    if haskey(params, "beam_section") && params["beam_section"] !== nothing
        bs = params["beam_section"]
        beam_sec = make_section_props(
            bs["name"], bs["A"], bs["d"], bs["bf"], bs["tf"], bs["tw"],
            bs["Sx"], bs["Sy"], bs["Ix"], bs["Iy"], bs["rx"], bs["ry"],
        )
        bd = solve_beam_design(Fy, max_beam_moment, max_beam_shear, Lb_beam, beam_sec; render=render)
        beam_design_result = bd.result
        if render && bd.latex !== nothing
            push!(latex_blocks, Dict("index" => block_idx, "step_title" => "Beam Design Check - $(beam_sec.name)", "latex" => string(bd.latex)))
            block_idx += 1
        end
    end

    if haskey(params, "column_section") && params["column_section"] !== nothing
        cs = params["column_section"]
        col_sec = make_section_props(
            cs["name"], cs["A"], cs["d"], cs["bf"], cs["tf"], cs["tw"],
            cs["Sx"], cs["Sy"], cs["Ix"], cs["Iy"], cs["rx"], cs["ry"],
        )
        beam_Ix_val = haskey(params, "beam_section") && params["beam_section"] !== nothing ?
            params["beam_section"]["Ix"] * 1e6 : cs["Ix"] * 1e6  # mm^4
        beam_L_val = haskey(params, "beam_span_design") ? Float64(params["beam_span_design"]) : maximum(bay_widths) * 1000  # mm

        cd = solve_column_design(Fy, max_col_axial, max_col_moment, L_column, col_sec, beam_Ix_val, beam_L_val; render=render)
        column_design_result = cd.result
        if render && cd.latex !== nothing
            push!(latex_blocks, Dict("index" => block_idx, "step_title" => "Column Design Check - $(col_sec.name)", "latex" => string(cd.latex)))
            block_idx += 1
        end
    end

    # -------------------------------------------------------------------------
    # Computed values summary
    # -------------------------------------------------------------------------
    computed_values = Dict(
        "max_beam_moment_kNm" => max_beam_moment,
        "max_beam_shear_kN" => max_beam_shear,
        "max_column_axial_kN" => max_col_axial,
        "max_column_moment_kNm" => max_col_moment,
        "max_portal_beam_shear_kN" => maximum(portal_bshear.result.beam_shear),
        "max_portal_column_axial_kN" => maximum(portal_axial.result.column_axial),
    )

    design_results = Dict{String,Any}()
    if beam_design_result !== nothing
        design_results["beam_section"] = beam_design_result.section.name
        design_results["beam_Sx_required_mm3"] = beam_design_result.Sx_required
        design_results["beam_compact_flange"] = beam_design_result.compact_flange
        design_results["beam_compact_web"] = beam_design_result.compact_web
        design_results["beam_ltb_case"] = beam_design_result.ltb_case
        design_results["beam_bending_safe"] = beam_design_result.bending_safe
        design_results["beam_shear_safe"] = beam_design_result.shear_safe
        design_results["beam_fb_actual_MPa"] = beam_design_result.fb_actual
        design_results["beam_Fb_allowable_MPa"] = beam_design_result.fb_allowable
        design_results["beam_fv_actual_MPa"] = beam_design_result.fv_actual
        design_results["beam_Fv_allowable_MPa"] = beam_design_result.fv_allowable
    end
    if column_design_result !== nothing
        design_results["column_section"] = column_design_result.section.name
        design_results["column_K"] = column_design_result.K
        design_results["column_slenderness_ratio"] = column_design_result.slenderness_ratio
        design_results["column_Cc"] = column_design_result.Cc
        design_results["column_is_short"] = column_design_result.is_short
        design_results["column_Fa_MPa"] = column_design_result.Fa
        design_results["column_fa_MPa"] = column_design_result.fa
        design_results["column_Fb_MPa"] = column_design_result.Fb
        design_results["column_fb_MPa"] = column_design_result.fb
        design_results["column_magnification_factor"] = column_design_result.magnification_factor
        design_results["column_stability_ratio"] = column_design_result.stability_ratio
        design_results["column_strength_ratio"] = column_design_result.strength_ratio
        design_results["column_stability_safe"] = column_design_result.stability_safe
        design_results["column_strength_safe"] = column_design_result.strength_safe
    end

    return Dict(
        "latex_blocks" => latex_blocks,
        "computed_values" => computed_values,
        "design_results" => design_results,
    )
end

# =============================================================================
# 12) HEADLESS RUN ADAPTER (JSON I/O)
# =============================================================================

"""
    _normalize_keys(params)

Map frontend/backend key names to the internal Julia key names.
Supports both naming conventions transparently.
"""
function _normalize_keys(params::Dict)
    p = copy(params)
    # Map backend key names -> Julia internal key names
    get!(p, "n_stories",       get(p, "num_storeys", nothing))
    get!(p, "bay_count",       get(p, "num_bays", nothing))
    get!(p, "height",          get(p, "storey_heights", nothing))
    get!(p, "bay_widths",      get(p, "bay_widths_abc", nothing))
    get!(p, "force_list",      get(p, "lateral_forces", nothing))
    get!(p, "Fy",              get(p, "fy", nothing))
    get!(p, "live_load_value", get(p, "live_load", nothing))
    get!(p, "Lb_beam",         get(p, "unbraced_length_beam", nothing))
    get!(p, "L_column",        get(p, "unbraced_length_column", nothing))
    # Derive tributary_width from bay widths if not provided
    if !haskey(p, "tributary_width") || p["tributary_width"] === nothing
        bw = get(p, "bay_widths", nothing)
        if bw !== nothing
            p["tributary_width"] = (bw isa AbstractVector ? sum(bw)/length(bw) : bw) / 2
        end
    end
    return p
end

function run(params::Dict)
    normalized = _normalize_keys(params)
    return solve_portal_frame(normalized; render=get(params, "render_latex", get(params, "render", true)))
end

# =============================================================================
# 13) CLI ENTRY POINT
# =============================================================================

if !isinteractive()
    input = JSON.parse(readline(stdin))
    # Convert JSON.Object to plain Dict for compatibility
    input = Dict{String,Any}(k => v for (k,v) in input)
    JSON.print(stdout, run(input))
end
