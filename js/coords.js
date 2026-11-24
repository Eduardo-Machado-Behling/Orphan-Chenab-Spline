// OC stream frame (phi1, phi2 in deg, d in kpc) -> Galactocentric kpc.
// ICRS = d * K19^T * unit vector, then the affine map x_gc = A x_icrs + b exported from astropy by tools/prep.py.
// Classic script; tools/check.mjs runs this file as-is against astropy.
function ocToGalcen(phi1, phi2, d, F) {
  const r = Math.PI / 180;
  const u = [Math.cos(phi1 * r) * Math.cos(phi2 * r), Math.sin(phi1 * r) * Math.cos(phi2 * r), Math.sin(phi2 * r)];
  const x = [0, 1, 2].map(j => d * (F.K19[0][j] * u[0] + F.K19[1][j] * u[1] + F.K19[2][j] * u[2]));
  return F.A.map((row, i) => row[0] * x[0] + row[1] * x[1] + row[2] * x[2] + F.b[i]);
}
