import * as THREE from 'three';
import {
  createAslanliPaverTexture,
  createBustInscriptionTexture,
  createInscriptionTexture,
  createKilimPlazaTexture,
  createLawnTexture,
  createTravertineTexture,
  createTurkishFlagTexture,
} from './textures';

export interface AnitkabirSceneRefs {
  root: THREE.Group;
  flagMesh: THREE.Mesh;
  flagBasePositions: Float32Array;
  nightLights: THREE.PointLight[];
  brazierFlames: THREE.Mesh[];
  dispose: () => void;
}

/**
 * Computes exact ground elevation (Y) at any (x, z) coordinate across Anitkabir:
 * - Upper Mozole terrace: y = 3.8 (x in [-26, 26], z in [-52, -22])
 * - Ceremonial stairs: smooth ramp from y = 0.2 (z = -12) to y = 3.8 (z = -22)
 * - Toren Meydani & Aslanli Yol: y = 0.2
 * - Baris Parki surrounding terrain: y = 0.0
 */
export function groundHeightAt(x: number, z: number): number {
  // Upper Mozole podium/terrace
  if (x >= -26 && x <= 26 && z >= -54 && z <= -22) {
    return 3.8;
  }
  // Ceremonial stairs
  if (x >= -19 && x <= 19 && z > -22 && z <= -12) {
    const t = (-12 - z) / 10; // 0 at bottom (-12), 1 at top (-22)
    return 0.2 + t * 3.6;
  }
  // Toren Meydani
  if (x >= -28 && x <= 28 && z >= -14 && z <= 32) {
    return 0.2;
  }
  // Aslanli Yol
  if (x >= 26 && x <= 116 && z >= -1 && z <= 13) {
    return 0.2;
  }
  return 0.0;
}

function createLionStatue(
  limestoneMat: THREE.Material,
  travertineMat: THREE.Material,
): THREE.Group {
  const lion = new THREE.Group();

  // 1. Stepped travertine pedestal
  const step1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 1.3), travertineMat);
  step1.position.y = 0.15;
  step1.castShadow = true;
  step1.receiveShadow = true;
  lion.add(step1);

  const step2 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.28, 1.05), travertineMat);
  step2.position.y = 0.44;
  step2.castShadow = true;
  step2.receiveShadow = true;
  lion.add(step2);

  // 2. Limestone plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.14, 0.82), limestoneMat);
  plinth.position.y = 0.65;
  plinth.castShadow = true;
  lion.add(plinth);

  // 3. Seated lion body (oriented along -X / +X depending on rotation)
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.56, 0.56), limestoneMat);
  body.position.set(0.12, 1.0, 0);
  body.castShadow = true;
  lion.add(body);

  // 4. Sculpted chest / mane block
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.64), limestoneMat);
  chest.position.set(-0.4, 1.15, 0);
  chest.castShadow = true;
  lion.add(chest);

  // 5. Hittite lion head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.52), limestoneMat);
  head.position.set(-0.56, 1.56, 0);
  head.castShadow = true;
  lion.add(head);

  // 6. Muzzle
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.32), limestoneMat);
  muzzle.position.set(-0.82, 1.48, 0);
  muzzle.castShadow = true;
  lion.add(muzzle);

  // 7. Front paws
  const pawL = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.18), limestoneMat);
  pawL.position.set(-0.62, 0.81, -0.18);
  const pawR = pawL.clone();
  pawR.position.z = 0.18;
  lion.add(pawL, pawR);

  return lion;
}

function createBrazier(bronzeMat: THREE.Material, flameMat: THREE.Material): {
  group: THREE.Group;
  flame: THREE.Mesh;
} {
  const group = new THREE.Group();

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.22, 12), bronzeMat);
  base.position.y = 0.11;
  base.castShadow = true;
  group.add(base);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.68, 12), bronzeMat);
  stem.position.y = 0.56;
  stem.castShadow = true;
  group.add(stem);

  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.05, 0),
        new THREE.Vector2(0.55, 0.12),
        new THREE.Vector2(0.68, 0.34),
        new THREE.Vector2(0.58, 0.38),
      ],
      16,
    ),
    bronzeMat,
  );
  bowl.position.y = 0.85;
  bowl.castShadow = true;
  group.add(bowl);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.48, 10), flameMat);
  flame.position.y = 1.32;
  flame.visible = false;
  group.add(flame);

  return { group, flame };
}

export function buildAnitkabirComplex(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
): AnitkabirSceneRefs {
  const root = new THREE.Group();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const disposables: Array<{ dispose: () => void }> = [];

  const travertineTex = createTravertineTexture(maxAniso);
  const kilimTex = createKilimPlazaTexture(maxAniso);
  const aslanliTex = createAslanliPaverTexture(maxAniso);
  const inscriptionTex = createInscriptionTexture(maxAniso);
  const flagTex = createTurkishFlagTexture(maxAniso);
  const bustInscriptionTex = createBustInscriptionTexture(maxAniso);
  const lawnTex = createLawnTexture(maxAniso);
  disposables.push(
    travertineTex,
    kilimTex,
    aslanliTex,
    inscriptionTex,
    flagTex,
    bustInscriptionTex,
    lawnTex,
  );

  const travertineMat = new THREE.MeshStandardMaterial({
    map: travertineTex,
    color: 0xe3c896,
    roughness: 0.78,
    metalness: 0.04,
  });

  const travertineDarkMat = new THREE.MeshStandardMaterial({
    map: travertineTex,
    color: 0xc29e65,
    roughness: 0.82,
    metalness: 0.05,
  });

  const limestoneMat = new THREE.MeshStandardMaterial({
    color: 0xd9d2c5,
    roughness: 0.72,
    metalness: 0.04,
  });

  const bronzeMat = new THREE.MeshStandardMaterial({
    color: 0x3a3228,
    roughness: 0.38,
    metalness: 0.82,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd9a84e,
    roughness: 0.28,
    metalness: 0.88,
  });

  const inscriptionMat = new THREE.MeshStandardMaterial({
    map: inscriptionTex,
    roughness: 0.55,
    metalness: 0.25,
  });

  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xffa733,
    transparent: true,
    opacity: 0.9,
  });

  const slateRoofMat = new THREE.MeshStandardMaterial({
    color: 0x67798a,
    roughness: 0.48,
    metalness: 0.34,
  });

  disposables.push(
    travertineMat,
    travertineDarkMat,
    limestoneMat,
    bronzeMat,
    goldMat,
    inscriptionMat,
    flameMat,
    slateRoofMat,
  );

  // 1. Baris Parki Terrain (wide rolling Ankara hill)
  const terrainGeo = new THREE.PlaneGeometry(460, 460, 48, 48);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const dist = Math.hypot(vx - 15, vz + 5);
    if (dist > 78) {
      const hill = Math.sin(vx * 0.025) * Math.cos(vz * 0.025) * 3.5 - Math.min(10, (dist - 78) * 0.08);
      posAttr.setY(i, hill);
    }
  }
  terrainGeo.computeVertexNormals();
  const terrainMat = new THREE.MeshStandardMaterial({
    map: lawnTex,
    color: 0xd8ecc4,
    roughness: 0.92,
    metalness: 0.0,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  root.add(terrain);
  disposables.push(terrainGeo, terrainMat);

  // 1b. Winding Asphalt Perimeter Roads flanking Baris Parki lawns
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x4b5058,
    roughness: 0.85,
    metalness: 0.05,
  });
  const roadCurves = [
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(124, 0.06, -18),
      new THREE.Vector3(78, 0.06, -24),
      new THREE.Vector3(36, 0.06, -26),
      new THREE.Vector3(-12, 0.06, -58),
      new THREE.Vector3(-48, 0.06, -34),
      new THREE.Vector3(-46, 0.06, 26),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(124, 0.06, 30),
      new THREE.Vector3(76, 0.06, 34),
      new THREE.Vector3(38, 0.06, 44),
      new THREE.Vector3(-18, 0.06, 52),
      new THREE.Vector3(-46, 0.06, 26),
    ]),
  ];
  for (const curve of roadCurves) {
    const roadGeo = new THREE.TubeGeometry(curve, 48, 2.2, 4, false);
    roadGeo.scale(1, 0.04, 1);
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    root.add(roadMesh);
    disposables.push(roadGeo);
  }
  disposables.push(roadMat);

  // 2. Toren Meydani (Ceremonial Plaza)
  const plazaBaseGeo = new THREE.BoxGeometry(56, 0.4, 46);
  const plazaMat = new THREE.MeshStandardMaterial({
    map: kilimTex,
    roughness: 0.72,
    metalness: 0.05,
  });
  const plaza = new THREE.Mesh(plazaBaseGeo, plazaMat);
  plaza.position.set(0, 0, 9);
  plaza.receiveShadow = true;
  root.add(plaza);
  disposables.push(plazaBaseGeo, plazaMat);

  // 3. Aslanli Yol (Road of Lions)
  const aslanliGeo = new THREE.BoxGeometry(90, 0.4, 14);
  const aslanliMat = new THREE.MeshStandardMaterial({
    map: aslanliTex,
    roughness: 0.78,
    metalness: 0.02,
  });
  const aslanliRoad = new THREE.Mesh(aslanliGeo, aslanliMat);
  aslanliRoad.position.set(71, 0, 6);
  aslanliRoad.receiveShadow = true;
  root.add(aslanliRoad);
  disposables.push(aslanliGeo, aslanliMat);

  // Low travertine balustrade walls along Aslanli Yol
  const wallGeo = new THREE.BoxGeometry(86, 0.95, 0.7);
  const wallNorth = new THREE.Mesh(wallGeo, travertineDarkMat);
  wallNorth.position.set(71, 0.65, -1.35);
  wallNorth.castShadow = true;
  wallNorth.receiveShadow = true;
  const wallSouth = wallNorth.clone();
  wallSouth.position.z = 13.35;
  root.add(wallNorth, wallSouth);
  disposables.push(wallGeo);

  // 24 Hittite Lion Statues (12 pairs) along Aslanli Yol
  for (let i = 0; i < 12; i++) {
    const lx = 33 + i * 6.8;
    const lionN = createLionStatue(limestoneMat, travertineDarkMat);
    lionN.position.set(lx, 0.2, 0.1);
    lionN.rotation.y = Math.PI / 2; // Facing the road
    root.add(lionN);

    const lionS = createLionStatue(limestoneMat, travertineDarkMat);
    lionS.position.set(lx, 0.2, 11.9);
    lionS.rotation.y = -Math.PI / 2;
    root.add(lionS);
  }

  // Entrance Towers (Istiklal & Hurriyet Kuleleri) at start of Aslanli Yol
  const towerGeo = new THREE.BoxGeometry(6.5, 9.5, 6.5);
  const towerRoofGeo = new THREE.ConeGeometry(4.9, 2.2, 4);
  towerRoofGeo.rotateY(Math.PI / 4);
  for (const tz of [-3.5, 15.5]) {
    const towerGroup = new THREE.Group();
    const body = new THREE.Mesh(towerGeo, travertineMat);
    body.position.y = 4.75;
    body.castShadow = true;
    body.receiveShadow = true;
    const roof = new THREE.Mesh(towerRoofGeo, travertineDarkMat);
    roof.position.y = 10.6;
    roof.castShadow = true;
    towerGroup.add(body, roof);
    towerGroup.position.set(116, 0, tz);
    root.add(towerGroup);
  }
  disposables.push(towerGeo, towerRoofGeo);

  // 4. Mozole Podium & Ceremonial Stairs (Hall of Honor Terrace)
  const podiumGeo = new THREE.BoxGeometry(52, 3.8, 30);
  const podium = new THREE.Mesh(podiumGeo, travertineDarkMat);
  podium.position.set(0, 1.9, -37);
  podium.castShadow = true;
  podium.receiveShadow = true;
  root.add(podium);
  disposables.push(podiumGeo);

  // 14 Ceremonial Steps rising from z = -12 (y=0.2) to z = -22 (y=3.8)
  const stepCount = 14;
  for (let s = 0; s < stepCount; s++) {
    const t = (s + 1) / stepCount;
    const stepH = t * 3.6 + 0.2;
    const stepZ = -12 - s * (10 / stepCount) - 0.35;
    const stepGeo = new THREE.BoxGeometry(36, stepH, 10 / stepCount + 0.1);
    const stepMesh = new THREE.Mesh(stepGeo, limestoneMat);
    stepMesh.position.set(0, stepH / 2, stepZ);
    stepMesh.receiveShadow = true;
    stepMesh.castShadow = true;
    root.add(stepMesh);
    disposables.push(stepGeo);
  }

  // Flanking terrace retaining walls + Bronze Braziers
  const flankGeo = new THREE.BoxGeometry(8, 3.8, 10);
  const flankL = new THREE.Mesh(flankGeo, travertineMat);
  flankL.position.set(-22, 1.9, -17);
  flankL.castShadow = true;
  flankL.receiveShadow = true;
  const flankR = flankL.clone();
  flankR.position.x = 22;
  root.add(flankL, flankR);
  disposables.push(flankGeo);

  const brazierFlames: THREE.Mesh[] = [];
  for (const bx of [-24, -20, 20, 24]) {
    const { group, flame } = createBrazier(bronzeMat, flameMat);
    group.position.set(bx, 3.8, -13.2);
    root.add(group);
    brazierFlames.push(flame);
  }

  // 5. Mozole (Hall of Honor - Seref Holu) Composite Monumental Architecture
  const mozoleGroup = new THREE.Group();
  mozoleGroup.position.set(0, 3.8, -36);

  // Inner core building
  const coreGeo = new THREE.BoxGeometry(31, 14.2, 17);
  const coreMesh = new THREE.Mesh(coreGeo, travertineMat);
  coreMesh.position.set(0, 7.1, 0);
  coreMesh.castShadow = true;
  coreMesh.receiveShadow = true;
  mozoleGroup.add(coreMesh);

  // Monumental entablature / frieze & cornice roof
  const friezeGeo = new THREE.BoxGeometry(38.6, 2.8, 22.6);
  const frieze = new THREE.Mesh(friezeGeo, travertineMat);
  frieze.position.set(0, 15.4, 0);
  frieze.castShadow = true;
  frieze.receiveShadow = true;
  mozoleGroup.add(frieze);

  const corniceGeo = new THREE.BoxGeometry(39.6, 0.7, 23.6);
  const cornice = new THREE.Mesh(corniceGeo, travertineDarkMat);
  cornice.position.set(0, 17.1, 0);
  cornice.castShadow = true;
  mozoleGroup.add(cornice);


  // 8 Front Colonnade Pillars + 5 Side Pillars each side
  const colShaftGeo = new THREE.BoxGeometry(1.75, 13.4, 1.75);
  const colBaseGeo = new THREE.BoxGeometry(2.15, 0.6, 2.15);
  const colCapGeo = new THREE.BoxGeometry(2.05, 0.55, 2.05);

  const addPillar = (px: number, pz: number) => {
    const pGroup = new THREE.Group();
    const base = new THREE.Mesh(colBaseGeo, travertineDarkMat);
    base.position.y = 0.3;
    const shaft = new THREE.Mesh(colShaftGeo, travertineMat);
    shaft.position.y = 7.0;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    const cap = new THREE.Mesh(colCapGeo, travertineDarkMat);
    cap.position.y = 13.85;
    pGroup.add(base, shaft, cap);
    pGroup.position.set(px, 0, pz);
    mozoleGroup.add(pGroup);
  };

  for (let i = 0; i < 8; i++) {
    const px = -16.8 + i * 4.8;
    addPillar(px, 10.2);
    addPillar(px, -10.2);
  }
  for (let i = 1; i <= 4; i++) {
    const pz = -10.2 + i * 4.08;
    addPillar(-16.8, pz);
    addPillar(16.8, pz);
  }

  // Dark recessed portal & bronze grille bars
  const portalBackGeo = new THREE.BoxGeometry(4.6, 10.8, 0.6);
  const portalBackMat = new THREE.MeshStandardMaterial({
    color: 0x16120e,
    roughness: 0.9,
  });
  const portalBack = new THREE.Mesh(portalBackGeo, portalBackMat);
  portalBack.position.set(0, 5.4, 8.55);
  mozoleGroup.add(portalBack);

  for (let g = -2; g <= 2; g++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 10.6, 0.12), bronzeMat);
    bar.position.set(g * 0.85, 5.3, 8.9);
    mozoleGroup.add(bar);
  }

  // Golden-inscribed speech panels flanking the portal
  const panelGeo = new THREE.PlaneGeometry(5.6, 9.2);
  const panelL = new THREE.Mesh(panelGeo, inscriptionMat);
  panelL.position.set(-7.2, 6.2, 8.58);
  const panelR = new THREE.Mesh(panelGeo, inscriptionMat);
  panelR.position.set(7.2, 6.2, 8.58);
  mozoleGroup.add(panelL, panelR);

  // Symbolic Sarcophagus (Lahit) glowing softly inside the portal threshold
  const lahitGeo = new THREE.BoxGeometry(2.2, 1.4, 1.2);
  const lahitMat = new THREE.MeshStandardMaterial({
    color: 0x8e2420,
    roughness: 0.25,
    metalness: 0.15,
  });
  const lahit = new THREE.Mesh(lahitGeo, lahitMat);
  lahit.position.set(0, 1.1, 7.6);
  mozoleGroup.add(lahit);

  // Warm architectural uplights for Night mode
  const nightLights: THREE.PointLight[] = [];
  if (!isSoftwareGl) {
    for (const lx of [-12, 0, 12]) {
      const pLight = new THREE.PointLight(0xffb454, 0, 26, 1.6);
      pLight.position.set(lx, 6.2, -26.5);
      root.add(pLight);
      nightLights.push(pLight);
    }
  } else {
    const pLight = new THREE.PointLight(0xffb454, 0, 35, 1.4);
    pLight.position.set(0, 7.2, -26.5);
    root.add(pLight);
    nightLights.push(pLight);
  }

  root.add(mozoleGroup);

  // 5b. Ceremonial Ataturk Bust Monument in front of Mozole (x=0, y=3.8, z=-25.8)
  const bustGroup = new THREE.Group();
  bustGroup.position.set(0, 3.8, -25.8);

  const graniteMat = new THREE.MeshStandardMaterial({
    color: 0x16181d,
    roughness: 0.28,
    metalness: 0.15,
  });
  const bustGoldMat = new THREE.MeshStandardMaterial({
    color: 0xd9b15f,
    roughness: 0.28,
    metalness: 0.86,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe5e7eb,
    roughness: 0.14,
    metalness: 0.94,
  });
  const bustPlaqueMat = new THREE.MeshStandardMaterial({
    map: bustInscriptionTex,
    roughness: 0.35,
    metalness: 0.2,
  });

  // Tapered black granite pedestal
  const pedGeo = new THREE.CylinderGeometry(0.72, 0.96, 1.85, 4);
  pedGeo.rotateY(Math.PI / 4);
  const pedestal = new THREE.Mesh(pedGeo, graniteMat);
  pedestal.position.y = 0.925;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  bustGroup.add(pedestal);

  // Top marble cap
  const capGeo = new THREE.BoxGeometry(1.12, 0.09, 1.12);
  const pedCap = new THREE.Mesh(capGeo, graniteMat);
  pedCap.position.y = 1.89;
  pedCap.castShadow = true;
  bustGroup.add(pedCap);

  // Front inscribed plaque tilted to match pedestal face
  const plaqueGeo = new THREE.PlaneGeometry(0.92, 1.48);
  const plaque = new THREE.Mesh(plaqueGeo, bustPlaqueMat);
  plaque.position.set(0, 0.95, 0.61);
  plaque.rotation.x = -0.09;
  bustGroup.add(plaque);

  // Golden-Bronze Ataturk Bust (multi-part sculpted silhouette)
  const bustChest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.56, 0.32), bustGoldMat);
  bustChest.position.set(0, 2.22, 0);
  bustChest.castShadow = true;
  const bustShoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.24, 0.28, 12), bustGoldMat);
  bustShoulders.scale.set(1.15, 1, 0.68);
  bustShoulders.position.set(0, 2.38, 0);
  bustShoulders.castShadow = true;
  const bustNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.2, 12), bustGoldMat);
  bustNeck.position.set(0, 2.58, 0);
  const bustHead = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 16), bustGoldMat);
  bustHead.scale.set(0.88, 1.12, 0.95);
  bustHead.position.set(0, 2.8, 0.02);
  bustHead.castShadow = true;
  const bustBrow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.1), bustGoldMat);
  bustBrow.position.set(0, 2.84, 0.14);
  const bustNose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.08), bustGoldMat);
  bustNose.position.set(0, 2.79, 0.18);
  const bustHair = new THREE.Mesh(new THREE.SphereGeometry(0.195, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), bustGoldMat);
  bustHair.position.set(0, 2.84, 0);
  bustHair.rotation.x = -0.18;
  bustGroup.add(bustChest, bustShoulders, bustNeck, bustHead, bustBrow, bustNose, bustHair);

  // 2 Flanking Chrome Flagpoles
  const cBaseGeo = new THREE.BoxGeometry(0.34, 0.12, 0.34);
  const cPoleGeo = new THREE.CylinderGeometry(0.04, 0.045, 3.6, 12);
  for (const px of [-1.55, 1.55]) {
    const cBase = new THREE.Mesh(cBaseGeo, chromeMat);
    cBase.position.set(px, 0.06, -0.15);
    cBase.castShadow = true;
    const cPole = new THREE.Mesh(cPoleGeo, chromeMat);
    cPole.position.set(px, 1.9, -0.15);
    cPole.castShadow = true;
    bustGroup.add(cBase, cPole);
  }

  root.add(bustGroup);
  disposables.push(
    graniteMat,
    bustGoldMat,
    chromeMat,
    bustPlaqueMat,
    pedGeo,
    capGeo,
    plaqueGeo,
    cBaseGeo,
    cPoleGeo,
  );
  disposables.push(
    coreGeo,
    friezeGeo,
    corniceGeo,
    colShaftGeo,
    colBaseGeo,
    colCapGeo,
    portalBackGeo,
    portalBackMat,
    panelGeo,
    lahitGeo,
    lahitMat,
  );

  // 6. U-Shaped Colonnaded Galleries (Arkadlar) around Toren Meydani
  const galleryRoofGeo = new THREE.BoxGeometry(5.2, 0.8, 38);
  const galleryBackGeo = new THREE.BoxGeometry(1.0, 5.4, 38);
  const galleryColGeo = new THREE.BoxGeometry(0.75, 5.2, 0.75);

  // West/South-West gallery (opposite Aslanli Yol, z-side)
  const buildGallery = (gx: number, gz: number, rotY: number, length: number) => {
    const gGroup = new THREE.Group();
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(5.4, 0.7, length),
      travertineMat,
    );
    roof.position.y = 5.4;
    roof.castShadow = true;

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 5.2, length),
      travertineDarkMat,
    );
    back.position.set(-2.1, 2.6, 0);
    back.castShadow = true;
    gGroup.add(roof, back);

    const cols = Math.floor(length / 3.2);
    for (let i = 0; i <= cols; i++) {
      const cz = -length / 2 + 1 + i * ((length - 2) / cols);
      const col = new THREE.Mesh(galleryColGeo, travertineMat);
      col.position.set(2.0, 2.6, cz);
      col.castShadow = true;
      gGroup.add(col);
    }

    gGroup.position.set(gx, 0.2, gz);
    gGroup.rotation.y = rotY;
    root.add(gGroup);
  };

  buildGallery(-27.5, 11, 0, 42);
  buildGallery(0, 32.5, Math.PI / 2, 54);
  buildGallery(27.5, 22, Math.PI, 20);
  // Symmetrical stair-flanking gallery wings
  buildGallery(-27.5, -16, 0, 14);
  buildGallery(27.5, -16, Math.PI, 14);
  disposables.push(galleryRoofGeo, galleryBackGeo, galleryColGeo);

  // 7. Monumental Turkish Flagpole & Waving Flag
  const poleGroup = new THREE.Group();
  poleGroup.position.set(23, 0.2, 26);

  const poleBase = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.35, 0.8, 16), travertineDarkMat);
  poleBase.position.y = 0.4;
  const poleShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.28, 28, 12), limestoneMat);
  poleShaft.position.y = 14.4;
  poleShaft.castShadow = true;
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), goldMat);
  finial.position.y = 28.5;
  poleGroup.add(poleBase, poleShaft, finial);

  const flagGeo = new THREE.PlaneGeometry(7.2, 4.8, 24, 14);
  const flagBasePositions = new Float32Array(flagGeo.attributes.position.array);
  const flagMat = new THREE.MeshStandardMaterial({
    map: flagTex,
    side: THREE.DoubleSide,
    roughness: 0.65,
    metalness: 0.05,
  });
  const flagMesh = new THREE.Mesh(flagGeo, flagMat);
  flagMesh.position.set(3.75, 25.6, 0);
  flagMesh.castShadow = true;
  poleGroup.add(flagMesh);
  root.add(poleGroup);
  disposables.push(flagGeo, flagMat);

  // 8. Baris Parki Landscaping: Dense Cypress Hedges, Lawn Trees, Shrubs & Outer Forest
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b382a, roughness: 0.92 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86 });
  disposables.push(trunkMat, foliageMat);

  // 8a. Tightly Packed Cypress Hedges lining both sides of Aslanli Yol
  const cypressPositions: Array<{ x: number; z: number; scale: number }> = [];
  for (let i = 0; i < 44; i++) {
    const tx = 29 + i * 2.0;
    cypressPositions.push({ x: tx, z: -2.8, scale: 0.95 + (i % 3) * 0.08 });
    cypressPositions.push({ x: tx, z: -4.4, scale: 0.88 + ((i + 1) % 3) * 0.08 });
    cypressPositions.push({ x: tx, z: 14.8, scale: 0.95 + ((i + 2) % 3) * 0.08 });
    cypressPositions.push({ x: tx, z: 16.4, scale: 0.88 + (i % 3) * 0.08 });
  }

  // 8b. Dense Outer Baris Parki Pine & Cypress Forest Ring
  for (let a = 0; a < 210; a++) {
    const angle = (a / 210) * Math.PI * 2;
    const ring = a % 4;
    const radius = 66 + ring * 13 + ((a * 17) % 9);
    const tx = Math.cos(angle) * radius + 12;
    const tz = Math.sin(angle) * radius - 4;
    if (tx > 24 && tx < 126 && tz > -8 && tz < 20) continue;
    cypressPositions.push({
      x: tx,
      z: tz,
      scale: 0.95 + ((a * 7) % 10) * 0.06,
    });
  }

  const cCount = cypressPositions.length;
  const cTrunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.8, 6);
  cTrunkGeo.translate(0, 0.9, 0);
  const cFoliageGeo = new THREE.ConeGeometry(1.35, 6.8, 8);
  cFoliageGeo.translate(0, 4.6, 0);

  const cTrunkInst = new THREE.InstancedMesh(cTrunkGeo, trunkMat, cCount);
  const cFoliageInst = new THREE.InstancedMesh(cFoliageGeo, foliageMat, cCount);
  cFoliageInst.castShadow = !isSoftwareGl;
  cFoliageInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  cypressPositions.forEach((tp, idx) => {
    const gy = groundHeightAt(tp.x, tp.z);
    dummy.position.set(tp.x, gy, tp.z);
    dummy.scale.set(tp.scale * 0.95, tp.scale * 1.15, tp.scale * 0.95);
    dummy.rotation.y = (idx * 1.37) % (Math.PI * 2);
    dummy.updateMatrix();
    cTrunkInst.setMatrixAt(idx, dummy.matrix);
    cFoliageInst.setMatrixAt(idx, dummy.matrix);

    const shade = 0.8 + ((idx * 19) % 30) * 0.01;
    tint.setRGB(0.14 * shade, 0.28 * shade, 0.14 * shade);
    cFoliageInst.setColorAt(idx, tint);
  });
  cTrunkInst.instanceMatrix.needsUpdate = true;
  cFoliageInst.instanceMatrix.needsUpdate = true;
  if (cFoliageInst.instanceColor) cFoliageInst.instanceColor.needsUpdate = true;
  cTrunkInst.computeBoundingSphere();
  cFoliageInst.computeBoundingSphere();
  root.add(cTrunkInst, cFoliageInst);
  disposables.push(cTrunkGeo, cFoliageGeo);

  // 8c. Rounded Broadleaf Trees & Ornamental Shrubs on the Manicured Lawns
  const lawnTreeSpots: Array<{ x: number; z: number; scale: number; isShrub: boolean }> = [
    // Lawns north of Aslanli Yol & behind Mozole
    { x: 44, z: -12, scale: 1.15, isShrub: false },
    { x: 58, z: -14, scale: 0.95, isShrub: false },
    { x: 74, z: -11, scale: 1.25, isShrub: false },
    { x: 92, z: -15, scale: 1.05, isShrub: false },
    { x: 36, z: -18, scale: 0.7, isShrub: true },
    { x: 64, z: -18, scale: 0.8, isShrub: true },
    { x: 84, z: -12, scale: 0.65, isShrub: true },
    // Lawns south of Aslanli Yol & flanking Toren Meydani
    { x: 42, z: 24, scale: 1.2, isShrub: false },
    { x: 56, z: 27, scale: 1.0, isShrub: false },
    { x: 72, z: 25, scale: 1.3, isShrub: false },
    { x: 88, z: 24, scale: 0.95, isShrub: false },
    { x: 48, z: 32, scale: 0.75, isShrub: true },
    { x: 65, z: 22, scale: 0.65, isShrub: true },
    { x: -34, z: -28, scale: 1.25, isShrub: false },
    { x: -36, z: -10, scale: 1.1, isShrub: false },
    { x: -38, z: 14, scale: 1.2, isShrub: false },
    { x: -35, z: 34, scale: 0.95, isShrub: false },
    { x: 34, z: -32, scale: 1.15, isShrub: false },
    { x: 38, z: -20, scale: 0.85, isShrub: false },
    { x: -16, z: -56, scale: 1.3, isShrub: false },
    { x: 14, z: -56, scale: 1.25, isShrub: false },
    { x: -34, z: -42, scale: 0.75, isShrub: true },
    { x: 34, z: -44, scale: 0.75, isShrub: true },
  ];

  const lCount = lawnTreeSpots.length;
  const bTrunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2.0, 6);
  bTrunkGeo.translate(0, 1.0, 0);
  const bCanopyGeo = new THREE.DodecahedronGeometry(2.1, 1);
  bCanopyGeo.translate(0, 3.3, 0);

  const bTrunkInst = new THREE.InstancedMesh(bTrunkGeo, trunkMat, lCount);
  const bCanopyInst = new THREE.InstancedMesh(bCanopyGeo, foliageMat, lCount);
  bCanopyInst.castShadow = !isSoftwareGl;
  bCanopyInst.receiveShadow = true;

  lawnTreeSpots.forEach((lt, idx) => {
    const gy = groundHeightAt(lt.x, lt.z);
    if (lt.isShrub) {
      dummy.position.set(lt.x, gy - 1.4, lt.z);
      dummy.scale.set(lt.scale * 0.9, lt.scale * 0.6, lt.scale * 0.9);
      dummy.updateMatrix();
      bCanopyInst.setMatrixAt(idx, dummy.matrix);
      dummy.scale.set(0.01, 0.01, 0.01);
      dummy.updateMatrix();
      bTrunkInst.setMatrixAt(idx, dummy.matrix);
    } else {
      dummy.position.set(lt.x, gy, lt.z);
      dummy.scale.set(lt.scale, lt.scale, lt.scale);
      dummy.rotation.y = idx * 0.9;
      dummy.updateMatrix();
      bTrunkInst.setMatrixAt(idx, dummy.matrix);
      bCanopyInst.setMatrixAt(idx, dummy.matrix);
    }

    // Mix of sunlit olive-emerald, deep pine, and occasional blue-spruce
    if (idx % 5 === 0) {
      tint.setRGB(0.2, 0.36, 0.34); // Blue-spruce accent
    } else if (idx % 2 === 0) {
      tint.setRGB(0.24, 0.42, 0.19); // Sunlit broadleaf green
    } else {
      tint.setRGB(0.18, 0.34, 0.16); // Rich olive green
    }
    bCanopyInst.setColorAt(idx, tint);
  });

  bTrunkInst.instanceMatrix.needsUpdate = true;
  bCanopyInst.instanceMatrix.needsUpdate = true;
  if (bCanopyInst.instanceColor) bCanopyInst.instanceColor.needsUpdate = true;
  bTrunkInst.computeBoundingSphere();
  bCanopyInst.computeBoundingSphere();
  root.add(bTrunkInst, bCanopyInst);
  disposables.push(bTrunkGeo, bCanopyGeo);

  return {
    root,
    flagMesh,
    flagBasePositions,
    nightLights,
    brazierFlames,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
