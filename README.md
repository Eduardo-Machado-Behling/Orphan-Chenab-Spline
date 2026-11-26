# Orphan-Chenab splines

An interactive 3-D page that rebuilds the **natural cubic splines** behind the S5 6-D map of the
Orphan-Chenab stream from the knot values the authors released. A JavaScript port of their Stan
spline code evaluates every spline live in the browser.

- **Live site:** https://eduardo-machado-behling.github.io/Orphan-Chenab-Spline/
- **Slides (PDF, pt-BR):** [slides/ligando-as-estrelas.pdf](slides/ligando-as-estrelas.pdf)

## The problem

The Orphan-Chenab (OC) stream is tidal debris from a likely dwarf galaxy, traced over about 200° of
sky. Koposov, Erkal, Li et al. (S⁵ Collaboration, 2023) combine Gaia, S⁵ and other spectroscopic
surveys to fit the sky track, distance, proper motions and radial velocity along φ₁. They fit natural
cubic splines in Stan, using binned Gaia star counts for the sky track and individual stars for
distance and radial velocity.

The enclosed masses come from a separate tidal-stripping model fitted to the full 6-D track. The
model includes the Milky Way's motion in response to the Large Magellanic Cloud (LMC). The paper
quotes the following values for its preferred oblate Milky Way halo model.

- Milky Way enclosed mass (2.85 ± 0.1) × 10¹¹ M☉ within 32.4 kpc
- LMC enclosed mass (7.02 ± 0.9) × 10¹⁰ M☉ within 32.8 kpc

## What the page shows

The page teaches natural cubic splines to computer science students who know basic calculus and
matrices. It follows the released velocity knots through smoothness constraints, natural boundary
conditions, a tridiagonal system, the Thomas algorithm, and evaluation of a selected interval.
A hand-worked system explains elimination and back substitution; live coefficients and a local
curve follow the same longitude selection as the stream explorer.

A separate **illustrative sandbox** has five fixed positions and editable dimensionless values.
Drag a knot vertically, use the arrow keys on a focused knot, or enter a number from -3 to 3 in
increments of 0.1. The curve and solved second derivatives update together. Reset restores the
initial values. Invalid entries preserve the last valid curve. These edits never alter the
published measurements. Both longitude selectors and chart pointers select in half-degree steps,
from -90 to 119.5 degrees; velocity is unavailable below -80 degrees.

The tidal-stripping diagrams, model comparison and mass-aperture diagrams retain the astronomical
context. Schematic trial curves and galaxy symbols are labelled illustrative. Deeper derivations,
the published-knot table, and the full second-derivative plot use native expandable sections.
Sixteen dotted-underlined terms offer short explanations specific to this application, with
further-reading links to Wikipedia, the study, and scientific references. Hover, focus, or tap
to open a hint; Escape or Close dismisses it. Browsers without native popovers get glossary links.
The header's **PT / EN** toggle switches the page between Brazilian Portuguese and English,
including hints, chart labels, validation messages, and accessibility text. It remembers the
choice locally when storage is available and preserves the selection, sandbox edits, and camera.
English is the default and remains available without JavaScript. Scientific values, formulas,
code, and source destinations are unchanged; numerical displays keep the existing decimal point.
In the 3-D map, a gold sightline links the Sun to the selected position. Its length is the
heliocentric distance in the readout. A hollow ring marks the selection. The disc, bulge,
sunburst and companion-galaxy sprite identify the context objects with enlarged symbols.

- **3-D scene** (Galactocentric kpc). The present-day centreline uses the φ₂(φ₁) and distance(φ₁)
  splines. Colour shows velocity along the Sun–star sightline in the Galactic standard of rest.
  The line is dashed across the RR Lyrae distance gap. The Sun, LMC and an illustrative Milky Way
  disc provide context.
- **2-D panels** on a shared φ₁ axis (φ₂, distance from the Sun, v_gsr). Each shows the knot values, bars from the
  posterior 16th to 84th percentile at each knot, and the spline. A hover cursor is linked to a
  marker on the 3-D stream. No band is drawn between the knots.
- **Solver panel.** The solved second derivatives z of the v_gsr spline, with z = 0 at both ends
  (the natural boundary condition) highlighted.

## Method: the spline engine

`js/spline.js` contains a port, not a copy, of `stan/spline.stan` from
[segasai/stan-splines](https://github.com/segasai/stan-splines). It is in moment form:

- `getcoeffs(nodes, vals)`: with h_i = n_{i+1} − n_i and b_i = (v_{i+1} − v_i)/h_i, the interior
  rows are h_{i−1} z_{i−1} + 2(h_{i−1} + h_i) z_i + h_i z_{i+1} = 6(b_i − b_{i−1}), and
  z_first = z_last = 0. Stan uses a dense solve (`M \ u`). The port uses the **Thomas algorithm**,
  which gives the same solution for this tridiagonal system.
- `findpos(nodes, x)`: the interval with n_i ≤ x < n_{i+1}. Like Stan's `reject`, it throws for any
  point outside, so nothing is ever extrapolated. Because the interval is half-open, the last knot
  itself is rejected, as it is in Stan. Drawn curves therefore stop 10⁻⁶ deg short of the last knot.
- `evaluate(nodes, vals, z, x)`: the `spline_eval` formula.

## Files

| file | what it does |
|---|---|
| `index.html` | markup, the import map for three.js, and the knot data inlined by `tools/prep.py` |
| `css/style.css` | all styles: light/dark tokens, layout, panel text sizes via container queries |
| `js/spline.js` | the spline engine: `getcoeffs`, `findpos`, `evaluate` |
| `js/coords.js` | `ocToGalcen`: stream frame → Galactocentric kpc |
| `js/data.js` | parses the inline data, builds one spline per table, shared colours |
| `js/plots.js` | the 2-D SVG panels and the pointer → φ₁ mapping |
| `js/scene.js` | the three.js scene, loaded with a dynamic `import()` |
| `js/main.js` | links the φ₁ cursor, slider, readout and 3-D marker |
| `js/lesson-model.js` | inspectable matrix rows and polynomial coefficients; isolated sandbox state |
| `js/lesson.js` | walkthrough plots, shared selection, and numeric/keyboard/pointer sandbox controls |

The JS files are classic scripts that run in order and share globals, not ES modules. Chrome blocks
external module scripts on `file://`, but it allows classic scripts and a dynamic `import()` of
three.js, so the page still works when opened from disk. If three.js can't load, the 2-D panels
still work and the 3-D view says what went wrong. `tools/check.mjs` runs `js/spline.js` and
`js/coords.js` as they are.

## Data provenance and decisions

**Data.** Zenodo [10.5281/zenodo.7644540](https://doi.org/10.5281/zenodo.7644540), `zenodo.zip`,
licensed CC BY 4.0. Only `tozenodo/measurements/` is used, and only these three files:

| table | knots | φ₁ range | quantity |
|---|---|---|---|
| `orphan_M_track_bins.fits` | 19 | −90 … 120 | φ₂ [deg] |
| `orphan_dmrr_bins.fits` | 14 | −85 … 120 | distance modulus; d [kpc] = 10^(dm/5 − 2) |
| `orphan_rv_bins.fits` | 20 | −80 … 120 | v_gsr [km/s] |

Each table has one spline. The velocity-coloured centreline covers their common domain, −80° ≤ φ₁ < 120°.

**Columns.** The data readme gives units but no column definitions. The files contain `phi1`, a
value column (`phi2`, `dm` or `rv_gsr`), an error column, and `perc16`, `perc50` and `perc84`. The
value differs slightly from `perc50`. However, the value and error columns match the paper's
Tables 4 and 6 (for example dm = 19.42 ± 0.09 at φ₁ = −85 and v_gsr = −132.4 ± 5.7 at φ₁ = −80).
**Assumption:** the value column is the knot value to interpolate, and `perc16`/`perc84` are drawn
only as error bars at the knots.

**Stream frame.** Section 3.1 of the paper uses the frame of Koposov et al. 2019 (K19). The
ICRS → (φ₁, φ₂) rotation matrix comes from K19 Appendix B and is identical to gala 1.12's
`OrphanKoposov19`. To check that the 2023 tables use this frame, the matrix was applied to
`spec_memb_paper.fits`: it reproduces the released `fi1`/`fi2` from `ra`/`dec` to better than 10⁻⁶ deg.

**Galactocentric frame.** Section 3.1 of the paper uses the astropy **v4.0** frame, which
`prep.py` sets explicitly:

| parameter | value |
|---|---|
| R☉ | 8.122 kpc |
| z☉ | 20.8 pc |
| Galactic centre (ICRS) | (266.4051°, −28.936175°) |
| roll | 0 |

Only positions are needed, so `prep.py` exports the map as x_gc = A·x_icrs + b. It derives A and b
from astropy and asserts the map is affine on 100 random points.

**LMC.**

- Centre: RA, Dec = (78.76°, −69.19°). This is the proper-motion rotation centre in Kallivayalil et al. 2013,
  Table 3 (from their companion "Paper II"). The paper's LMC
  proper-motion prior (1.91, 0.229) mas/yr also comes from Kallivayalil et al. 2013.
- Distance: 49.59 kpc (Pietrzyński et al. 2019), the mean of the paper's Table 1 prior.

Resulting LMC position: (−1.05, −40.62, −27.54) kpc.

## Licences and credit

| part | licence and credit |
|---|---|
| Data | CC BY 4.0. Koposov, Erkal, Li et al. 2023, MNRAS 521, 4936, [doi:10.1093/mnras/stad551](https://doi.org/10.1093/mnras/stad551), [arXiv:2211.04495](https://arxiv.org/abs/2211.04495) |
| Spline method | [segasai/stan-splines](https://github.com/segasai/stan-splines) by S. Koposov. Public but has **no licence file**; this repo contains an independent port, not a copy, and credits the original |
| Runtime library | three.js 0.169.0 (MIT), loaded from jsDelivr through an import map |
| This repo's code | MIT (see `LICENSE`) |

## Verification

The learning features have additional numerical and DOM integration checks:

```
node tools/check-lesson.mjs
npm ci --prefix tools
node tools/check-lesson-ui.mjs
node tools/check-hints.mjs
node tools/check-language.mjs
```

LinkeDOM is a development-only dependency under `tools/`; it is not loaded by the page. The
integration suite runs page scripts and DOM event handlers, covering edits, validation, reset,
shared selection, out-of-domain recovery, and data isolation. Hint checks simulate the native
popover API to verify hover continuity, focus, dismissal, viewport placement, and the glossary
fallback. These checks do not render CSS or verify native browser behavior.
The language suite checks translated prose and live states, state preservation, source/data
integrity, persistence, and unavailable storage. These automated suites do not replace
a real-browser desktop/mobile accessibility and visual check. Browser inspection was unavailable
during the learning-feature implementation; the earlier browser checks below refer to the
previous page, not this new layout.

`python tools/prep.py <…/tozenodo/measurements>` builds `tools/reference.json` with scipy
`CubicSpline(bc_type='natural')` and astropy: 50 φ₁ values per table, the z at the knots, and 50 3-D
positions. `node tools/check.mjs` runs the page's own `js/spline.js` and `js/coords.js` against that reference:

```
phi2: z vs scipy           max |err| = 1.21e-17
phi2: S(x) vs scipy        max |err| = 4.44e-16
dm: z vs scipy             max |err| = 2.39e-18
dm: S(x) vs scipy          max |err| = 3.55e-15
rv: z vs scipy             max |err| = 3.33e-16
rv: S(x) vs scipy          max |err| = 5.68e-14
3-D position [kpc] vs astropy max |err| = 8.53e-14
PASS
```

The check also asserts that z = 0 at both ends, and that `findpos` rejects points before the first
knot and at the last knot.

The page was checked in a browser with no console errors:

- at 400 px wide and on desktop
- in light and dark mode
- over `http://` and from `file://` (headless Edge)

## Limitations

- **Galactic-plane crossing.** The distance panel shades −10° to +20°, where the paper found no
  likely RR Lyrae members (§3.3). The dashed 3-D section shows the interpolation over those same
  longitudes. The sky track and radial velocity use different tracers and knot grids.
- **Uncertainties.** The bars are posterior percentiles at the knots only. Between knots no
  uncertainty is shown: a correct band needs the joint posterior samples of all knot values, and
  those are not in the released tables.
- **Proper motions.** The display omits both components (`orphan_pm1/pm2_bins`). Correcting them for
  the Sun's motion shows southern stars moving across the centreline (§4.4).
- **Illustrative elements.** The disc and the marker sizes are illustrative. The LMC is drawn as a
  point at its centre.

## Deploy (GitHub Pages)

The site is static files: `index.html` (which carries the data inline), `css/` and `js/`. There is
no build step, no server and no API call; three.js comes from a pinned CDN URL. Push the repo to
GitHub, then open Settings → Pages, choose "Deploy from a branch", and pick branch `main` with folder
`/` (root). To serve from `/docs` instead, move `index.html`, `css/` and `js/` into `docs/` and pick
`/docs`; all paths are relative. In that case also update the `../index.html` and `../js/` paths in
`tools/prep.py` and `tools/check.mjs`. Opening `index.html` directly from disk also works.

## Reproduce

```
pip install astropy numpy scipy pyyaml
python tools/prep.py path/to/tozenodo/measurements   # regenerates the inline data and reference.json
node tools/check.mjs
```

## Possible extensions

- Proper-motion panels (μφ₁, μφ₂) from `orphan_M_pm1/pm2_bins.fits`.
- The released mass profiles (`mass_profiles/*.fits`) as a 2-D panel.
- Uncertainty bands drawn from posterior samples of the knot values, if they are released.
- Spectroscopic members (`spec_memb_paper.fits`) as points in 3-D.
