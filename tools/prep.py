"""Offline prep (run once): FITS knot tables -> JSON inlined into index.html, plus a
scipy/astropy reference for tools/check.mjs.

Usage: python tools/prep.py <path to tozenodo/measurements>
Needs astropy, numpy, scipy. Splines are evaluated here ONLY to build the reference;
the page builds and evaluates every spline itself.
"""
import json, re, sys
from pathlib import Path
import numpy as np
import astropy.units as u
from astropy.coordinates import SkyCoord, Galactocentric, galactocentric_frame_defaults
from astropy.table import Table
from scipy.interpolate import CubicSpline

ROOT = Path(__file__).resolve().parent.parent
MEAS = Path(sys.argv[1])

# One spline per table. Columns (verified in the files): phi1, value, error, perc16, perc50, perc84.
# value/error match the paper's Tables 4 and 6 (e.g. dm 19.42 +- 0.09 at phi1=-85), so the
# knot values are the value column; perc16/perc84 are only drawn as error bars.
TABLES = {"phi2": "orphan_M_track_bins.fits", "dm": "orphan_dmrr_bins.fits", "rv": "orphan_rv_bins.fits"}

# ICRS -> OC (phi1, phi2) rotation, Koposov et al. 2019 (K19) Appendix B; S5 2023 Sec. 3.1 uses
# the K19 frame. Same matrix as gala 1.12 OrphanKoposov19. It reproduces fi1/fi2 of
# spec_memb_paper.fits from ra/dec to < 1e-6 deg.
K19 = np.array([[-0.44761231, -0.08785756, -0.88990128],
                [-0.84246097, 0.37511331, 0.38671632],
                [0.29983786, 0.92280606, -0.2419219]])

# LMC: centre RA, Dec = 78.76, -69.19 deg (proper-motion rotation centre, Kallivayalil et al. 2013
# Table 3); distance 49.59 kpc (Pietrzynski et
# al. 2019, the mean of the S5 2023 Table 1 prior).
LMC = dict(ra=78.76, dec=-69.19, d=49.59)

galactocentric_frame_defaults.set("v4.0")  # the paper's Sec. 3.1: astropy v4.0 Galactocentric frame
GC = Galactocentric()


def icrs_to_gc(xyz):
    """Heliocentric ICRS cartesian (kpc, shape (3, N)) -> astropy Galactocentric (kpc)."""
    c = SkyCoord(x=xyz[0] * u.kpc, y=xyz[1] * u.kpc, z=xyz[2] * u.kpc, frame="icrs",
                 representation_type="cartesian").transform_to(GC)
    return np.array([c.x.to_value(u.kpc), c.y.to_value(u.kpc), c.z.to_value(u.kpc)])


def oc_to_icrs_xyz(phi1, phi2, d):
    """OC (deg, deg, kpc) -> heliocentric ICRS cartesian (kpc), via K19 transposed."""
    p1, p2 = np.deg2rad(phi1), np.deg2rad(phi2)
    return K19.T @ (d * np.array([np.cos(p1) * np.cos(p2), np.sin(p1) * np.cos(p2), np.sin(p2)]))


def grid(nodes, n=50):
    """n points across the knot range; Stan's findpos is half-open, so stop 1e-6 deg short."""
    return np.linspace(nodes[0], nodes[-1] - 1e-6, n)


# Positions are an affine map x_gc = A x_icrs + b; derive A, b from astropy and check it.
b = icrs_to_gc(np.zeros((3, 1)))[:, 0]
A = icrs_to_gc(np.eye(3)) - b[:, None]
pts = np.random.default_rng(1).normal(scale=50, size=(3, 100))
assert np.abs(A @ pts + b[:, None] - icrs_to_gc(pts)).max() < 1e-9, "Galactocentric map is not affine"

knots, ref = {}, {}
for key, fname in TABLES.items():
    t = Table.read(MEAS / fname)
    c = t.colnames
    assert c[0] == "phi1" and c[3:] == ["perc16", "perc50", "perc84"], c
    x, y = np.array(t["phi1"], float), np.array(t[c[1]], float)
    knots[key] = dict(file=fname, column=c[1], phi1=x.tolist(), val=y.tolist(),
                      p16=np.array(t["perc16"], float).tolist(), p84=np.array(t["perc84"], float).tolist())
    cs = CubicSpline(x, y, bc_type="natural")
    xs = grid(x)
    ref[key] = dict(phi1=xs.tolist(), val=cs(xs).tolist(), z=cs(x, 2).tolist())

# 3-D reference over the range where all three tables have knots.
lo = max(k["phi1"][0] for k in knots.values())
hi = min(k["phi1"][-1] for k in knots.values())
xs = grid([lo, hi])
s = {k: CubicSpline(v["phi1"], v["val"], bc_type="natural") for k, v in knots.items()}
dist = 10 ** (s["dm"](xs) / 5 - 2)
ref["pos"] = dict(phi1=xs.tolist(), xyz=icrs_to_gc(oc_to_icrs_xyz(xs, s["phi2"](xs), dist)).T.tolist())

lmc = icrs_to_gc(SkyCoord(ra=LMC["ra"] * u.deg, dec=LMC["dec"] * u.deg, distance=LMC["d"] * u.kpc)
                 .cartesian.xyz.to_value(u.kpc)[:, None])[:, 0]
frame = dict(K19=K19.tolist(), A=A.tolist(), b=b.tolist(), lmc=lmc.tolist(), range=[lo, hi])
print("Galactocentric (astropy v4.0):", GC, "\nSun:", b, "\nLMC:", lmc)

(ROOT / "tools" / "reference.json").write_text(json.dumps(ref))
html = ROOT / "index.html"
blob = json.dumps(dict(knots=knots, frame=frame), separators=(",", ":"))
new, n = re.subn(r'(<script type="application/json" id="knots">).*?(</script>)',
                 lambda m: m[1] + blob + m[2], html.read_text(encoding="utf8"), flags=re.S)
assert n == 1, "knots <script> tag not found in index.html"
html.write_text(new, encoding="utf8")
print("wrote tools/reference.json and inlined", len(blob), "bytes into index.html")
