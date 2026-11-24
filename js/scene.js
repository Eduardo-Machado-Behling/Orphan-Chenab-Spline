// 3-D view of the stream (Galactocentric kpc, z up). three.js comes in through a dynamic import(), which
// uses the page's import map and, unlike an external module script, also works when the page is opened from disk.
// Resolves to a function that moves the marker to a phi1.
async function startScene() {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

  const box = $('scene'), renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(devicePixelRatio);
  box.append(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.1, 3000);
  camera.up.set(0, 0, 1);                                // use Galactocentric axes directly, no remapping
  camera.position.set(-95, -120, 75);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !matchMedia('(prefers-reduced-motion: reduce)').matches;  // no coasting after a drag
  controls.listenToKeyEvents(box);                       // focused view: arrows pan, Shift/Ctrl + arrows rotate
  scene.add(new THREE.AmbientLight(0xffffff, 1.6), camera);
  camera.add(new THREE.DirectionalLight(0xffffff, 1.8));
  const ball = (r, color, p) => {                        // small lit sphere at p
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshLambertMaterial({ color }));
    m.position.copy(p);
    return scene.add(m), m;
  };

  const pos = p => new THREE.Vector3(...ocToGalcen(p, S.phi2(p), kpc(S.dm(p)), frame));
  const solid = new THREE.LineBasicMaterial({ vertexColors: true });
  const dashed = new THREE.LineDashedMaterial({ vertexColors: true, dashSize: 1, gapSize: 0.8 });
  const [gapStart, gapEnd] = RR_LYRAE_GAP;
  const segments = [[LO, gapStart, solid], [gapStart, gapEnd, dashed], [gapEnd, HI - 1e-6, solid]];
  for (const [from, to, material] of segments) {
    const steps = Math.ceil((to - from) * 2);
    const angles = Array.from({ length: steps + 1 }, (_, i) => from + (to - from) * (i / steps));
    const geometry = new THREE.BufferGeometry().setFromPoints(angles.map(pos));
    const colors = angles.flatMap(phi1 => {
      const [r, g, b] = rvColor(S.rv(phi1));
      return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace).toArray();
    });
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const line = new THREE.Line(geometry, material);
    if (material === dashed) line.computeLineDistances();
    scene.add(line);
  }

  scene.add(new THREE.Mesh(new THREE.CircleGeometry(15, 96),   // illustrative Milky Way disc in the x-y plane
    new THREE.MeshBasicMaterial({ color: 0x8fa3d6, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })));
  const sun = new THREE.Vector3(...frame.b), lmc = new THREE.Vector3(...frame.lmc);
  ball(0.8, 0xc9d3ee, new THREE.Vector3()); ball(1.1, 0xf2c14e, sun); ball(2.5, 0x9fb2dc, lmc);
  const marker = ball(1.2, 0xffffff, new THREE.Vector3());

  const tags = [['Sun', sun], ['LMC', lmc], ['Galactic centre', new THREE.Vector3()], ['φ₁ = −80°', pos(LO)], ['φ₁ = 120°', pos(HI - 1e-6)]]
    .map(([text, v]) => { const s = document.createElement('span'); s.className = 'tag'; s.textContent = text; box.append(s); return [s, v]; });
  let w = 1, h = 1;                                      // view size, updated on resize so the render loop never reads layout
  function placeTags() {                                 // project 3-D anchor points to HTML labels
    for (const [s, v] of tags) {
      const p = v.clone().project(camera);
      s.hidden = p.z > 1;
      s.style.transform = `translate(${(p.x + 1) / 2 * w}px, ${(1 - p.y) / 2 * h - 8}px)`;
    }
  }
  let fitted = false;                                    // later resizes keep the user's zoom and pan
  new ResizeObserver(() => {
    [w, h] = [box.clientWidth, box.clientHeight];
    renderer.setSize(w, h);
    camera.aspect = w / h;
    if (!fitted) camera.position.setLength(170 * Math.max(1, 1.1 / camera.aspect));  // first fit only: back off on portrait screens
    fitted = true;
    camera.updateProjectionMatrix();
  }).observe(box);
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); placeTags(); });

  return x => {
    marker.visible = x >= LO && x < HI;
    if (marker.visible) marker.position.copy(pos(x));
  };
}
