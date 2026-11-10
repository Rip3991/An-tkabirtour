import * as THREE from 'three';
import { groundHeightAt } from './anitkabirBuilder';
import { createContactShadowTexture } from './textures';

export type CeremonyPhase =
  | 'idle'
  | 'marching_in'
  | 'placing_wreath'
  | 'saluting'
  | 'marching_out';

interface SoldierRig {
  group: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  rightForearm: THREE.Group;
  leftForearm: THREE.Group;
  saluteBlend: number;
  carryBlend: number;
}

interface PlacedWreathEntry {
  group: THREE.Group;
  age: number;
  disposables: Array<{ dispose: () => void }>;
}

export class CeremonyManager {
  public readonly root = new THREE.Group();
  private sentries: SoldierRig[] = [];
  private bearers: SoldierRig[] = [];
  private commander!: SoldierRig;
  private carriedWreath!: THREE.Group;
  private placedWreathsGroup = new THREE.Group();
  private placedWreaths: PlacedWreathEntry[] = [];
  private ceremonyQueue: string[] = [];
  private currentDonor = 'Tören Kıta Komutanlığı';

  private phase: CeremonyPhase = 'idle';
  private phaseTimer = 0;
  private marchProgress = 0;
  private manualSaluteTimer = 0;
  private walkPhase = 0;

  private shadowTex: THREE.CanvasTexture;
  private disposables: Array<{ dispose: () => void }> = [];

  // Waypoints from Toren Meydani up the ceremonial stairs to Ataturk Bust front
  private readonly startPos = new THREE.Vector3(0, 0.2, 6);
  private readonly stairFoot = new THREE.Vector3(0, 0.2, -11.5);
  private readonly stairTop = new THREE.Vector3(0, 3.8, -22.2);
  private readonly mozoleStop = new THREE.Vector3(0, 3.8, -23.9);

  constructor() {
    this.shadowTex = createContactShadowTexture();
    this.disposables.push(this.shadowTex);
    this.root.add(this.placedWreathsGroup);

    // 2 Permanent Honor Guard Sentries flanking the Mozole portal
    const sentryL = this.createSoldier(true);
    sentryL.group.position.set(-4.2, 3.8, -26.4);
    sentryL.group.rotation.y = 0; // Facing +Z (towards Plaza)
    this.root.add(sentryL.group);
    this.sentries.push(sentryL);

    const sentryR = this.createSoldier(true);
    sentryR.group.position.set(4.2, 3.8, -26.4);
    sentryR.group.rotation.y = 0;
    this.root.add(sentryR.group);
    this.sentries.push(sentryR);

    // 2 Wreath Bearers + 1 Commander (hidden until ceremony starts)
    const bearerL = this.createSoldier(false);
    const bearerR = this.createSoldier(false);
    this.commander = this.createSoldier(true);
    bearerL.group.visible = false;
    bearerR.group.visible = false;
    this.commander.group.visible = false;
    this.root.add(bearerL.group, bearerR.group, this.commander.group);
    this.bearers.push(bearerL, bearerR);

    const carried = this.createCeremonialWreath();
    this.carriedWreath = carried.group;
    this.disposables.push(...carried.localDisposables);
    this.carriedWreath.visible = false;
    this.root.add(this.carriedWreath);
  }

  private createDonorRibbonTexture(donorName: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 116);

    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(donorName.slice(0, 22), 256, 64);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createCeremonialWreath(donorName?: string): {
    group: THREE.Group;
    localDisposables: Array<{ dispose: () => void }>;
  } {
    const wGroup = new THREE.Group();
    const localDisposables: Array<{ dispose: () => void }> = [];

    const standMat = new THREE.MeshStandardMaterial({
      color: 0xb8860b,
      roughness: 0.35,
      metalness: 0.75,
    });
    const redMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.6,
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.55,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x1e5631,
      roughness: 0.75,
    });
    localDisposables.push(standMat, redMat, whiteMat, leafMat);

    // Tripod stand
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.55, 6);
    const legL = new THREE.Mesh(legGeo, standMat);
    legL.position.set(-0.35, 0.72, 0.12);
    legL.rotation.z = -0.2;
    legL.rotation.x = 0.15;
    const legR = new THREE.Mesh(legGeo, standMat);
    legR.position.set(0.35, 0.72, 0.12);
    legR.rotation.z = 0.2;
    legR.rotation.x = 0.15;
    const legBack = new THREE.Mesh(legGeo, standMat);
    legBack.position.set(0, 0.72, -0.35);
    legBack.rotation.x = -0.28;
    wGroup.add(legL, legR, legBack);

    // Outer foliage ring
    const ringGeo = new THREE.TorusGeometry(0.56, 0.12, 10, 24);
    const foliageRing = new THREE.Mesh(ringGeo, leafMat);
    foliageRing.position.set(0, 1.25, 0.05);
    foliageRing.castShadow = true;
    wGroup.add(foliageRing);

    // Red & White carnation rings
    const redRingGeo = new THREE.TorusGeometry(0.52, 0.09, 8, 24);
    const redRing = new THREE.Mesh(redRingGeo, redMat);
    redRing.position.set(0, 1.25, 0.11);
    const whiteRingGeo = new THREE.TorusGeometry(0.38, 0.06, 8, 20);
    const whiteRing = new THREE.Mesh(whiteRingGeo, whiteMat);
    whiteRing.position.set(0, 1.25, 0.12);
    wGroup.add(redRing, whiteRing);

    // Ceremonial red ribbon sash with donor name
    const ribbonGeo = new THREE.BoxGeometry(0.22, 0.75, 0.03);
    const ribbon = new THREE.Mesh(ribbonGeo, redMat);
    ribbon.position.set(0, 0.65, 0.18);
    wGroup.add(ribbon);

    if (donorName) {
      const bannerTex = this.createDonorRibbonTexture(donorName);
      const bannerMat = new THREE.MeshBasicMaterial({
        map: bannerTex,
        side: THREE.DoubleSide,
      });
      const bannerGeo = new THREE.PlaneGeometry(1.18, 0.28);
      const banner = new THREE.Mesh(bannerGeo, bannerMat);
      banner.position.set(0, 0.42, 0.22);
      wGroup.add(banner);
      localDisposables.push(bannerTex, bannerMat, bannerGeo);
    }

    localDisposables.push(legGeo, ringGeo, redRingGeo, whiteRingGeo, ribbonGeo);
    return { group: wGroup, localDisposables };
  }

  private createSoldier(isOfficer: boolean): SoldierRig {
    const group = new THREE.Group();

    const uniformMat = new THREE.MeshStandardMaterial({
      color: isOfficer ? 0x2a332b : 0x3b4739,
      roughness: 0.72,
      metalness: 0.08,
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x262e27,
      roughness: 0.78,
    });
    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.3,
      metalness: 0.25,
    });
    const beltMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.45,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.25,
      metalness: 0.85,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xe8ba98,
      roughness: 0.65,
    });
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    });
    this.disposables.push(uniformMat, pantsMat, bootMat, beltMat, goldMat, skinMat, shadowMat);

    // Contact shadow
    const shadowGeo = new THREE.PlaneGeometry(1.05, 1.05);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.y = 0.02;
    group.add(shadow);

    // Legs (pivoted at hip y = 0.72)
    const legGeo = new THREE.BoxGeometry(0.17, 0.54, 0.19);
    const bootGeo = new THREE.BoxGeometry(0.18, 0.2, 0.24);
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.11, 0.72, 0);
    const lLegMesh = new THREE.Mesh(legGeo, pantsMat);
    lLegMesh.position.y = -0.27;
    lLegMesh.castShadow = true;
    const lBoot = new THREE.Mesh(bootGeo, bootMat);
    lBoot.position.set(0, -0.62, 0.02);
    leftLeg.add(lLegMesh, lBoot);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.11, 0.72, 0);
    const rLegMesh = new THREE.Mesh(legGeo, pantsMat);
    rLegMesh.position.y = -0.27;
    rLegMesh.castShadow = true;
    const rBoot = new THREE.Mesh(bootGeo, bootMat);
    rBoot.position.set(0, -0.62, 0.02);
    rightLeg.add(rLegMesh, rBoot);
    group.add(leftLeg, rightLeg);

    // Torso group (pivoted at waist y = 0.72)
    const torso = new THREE.Group();
    torso.position.y = 0.72;
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.26), uniformMat);
    jacket.position.y = 0.31;
    jacket.castShadow = true;
    torso.add(jacket);

    // White ceremonial belt & gold buckle
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.28), beltMat);
    belt.position.y = 0.08;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.3), goldMat);
    buckle.position.y = 0.08;
    torso.add(belt, buckle);

    // Gold shoulder epaulets
    const epGeo = new THREE.BoxGeometry(0.15, 0.04, 0.14);
    const epL = new THREE.Mesh(epGeo, goldMat);
    epL.position.set(-0.19, 0.63, 0);
    const epR = epL.clone();
    epR.position.x = 0.19;
    torso.add(epL, epR);

    // Articulated Arms (Shoulder -> Upper Arm -> Elbow -> Forearm + White Glove)
    const upperGeo = new THREE.BoxGeometry(0.13, 0.28, 0.14);
    const foreGeo = new THREE.BoxGeometry(0.11, 0.26, 0.12);
    const gloveGeo = new THREE.BoxGeometry(0.11, 0.11, 0.12);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.3, 0.58, 0);
    const lUpper = new THREE.Mesh(upperGeo, uniformMat);
    lUpper.position.y = -0.14;
    lUpper.castShadow = true;
    const leftForearm = new THREE.Group();
    leftForearm.position.set(0, -0.28, 0);
    const lFore = new THREE.Mesh(foreGeo, uniformMat);
    lFore.position.y = -0.13;
    const lGlove = new THREE.Mesh(gloveGeo, beltMat);
    lGlove.position.y = -0.29;
    leftForearm.add(lFore, lGlove);
    leftArm.add(lUpper, leftForearm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.3, 0.58, 0);
    const rUpper = new THREE.Mesh(upperGeo, uniformMat);
    rUpper.position.y = -0.14;
    rUpper.castShadow = true;
    const rightForearm = new THREE.Group();
    rightForearm.position.set(0, -0.28, 0);
    const rFore = new THREE.Mesh(foreGeo, uniformMat);
    rFore.position.y = -0.13;
    const rGlove = new THREE.Mesh(gloveGeo, beltMat);
    rGlove.position.y = -0.29;
    rightForearm.add(rFore, rGlove);
    rightArm.add(rUpper, rightForearm);

    torso.add(leftArm, rightArm);

    // Head + Officer Peaked Cap
    const head = new THREE.Group();
    head.position.y = 0.78;
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), skinMat);
    headMesh.castShadow = true;
    const capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.12, 14), uniformMat);
    capCrown.position.y = 0.14;
    const capBand = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.05, 14), bootMat);
    capBand.position.y = 0.08;
    const capVisor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.14), bootMat);
    capVisor.position.set(0, 0.06, 0.16);
    capVisor.rotation.x = 0.2;
    const capBadge = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), goldMat);
    capBadge.position.set(0, 0.12, 0.17);
    head.add(headMesh, capCrown, capBand, capVisor, capBadge);
    torso.add(head);

    group.add(torso);
    this.disposables.push(shadowGeo, legGeo, bootGeo, epGeo, upperGeo, foreGeo, gloveGeo);

    return {
      group,
      torso,
      head,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      rightForearm,
      leftForearm,
      saluteBlend: 0,
      carryBlend: 0,
    };
  }

  public startWreathCeremony(donorName = 'Tören Kıta Komutanlığı') {
    if (this.phase !== 'idle') {
      if (this.ceremonyQueue.length < 10) {
        this.ceremonyQueue.push(donorName);
      }
      return;
    }
    this.currentDonor = donorName;
    this.phase = 'marching_in';
    this.phaseTimer = 0;
    this.marchProgress = 0;
    this.walkPhase = 0;

    this.bearers.forEach((b) => {
      b.group.visible = true;
      b.carryBlend = 1;
    });
    this.commander.group.visible = true;
    this.carriedWreath.visible = true;
    this.updateMarchPositions(0);
  }

  public triggerSalute(duration = 4.0) {
    this.manualSaluteTimer = Math.max(this.manualSaluteTimer, duration);
  }

  public clearWreaths() {
    while (this.placedWreathsGroup.children.length > 0) {
      this.placedWreathsGroup.remove(this.placedWreathsGroup.children[0]);
    }
    for (const entry of this.placedWreaths) {
      entry.disposables.forEach((d) => d.dispose());
    }
    this.placedWreaths = [];
    this.ceremonyQueue = [];
  }

  public getPhase(): CeremonyPhase {
    return this.phase;
  }

  private samplePath(t: number, out: THREE.Vector3) {
    // Smooth 3-segment path: startPos -> stairFoot -> stairTop -> mozoleStop
    if (t < 0.45) {
      const u = t / 0.45;
      out.lerpVectors(this.startPos, this.stairFoot, u);
    } else if (t < 0.85) {
      const u = (t - 0.45) / 0.4;
      out.lerpVectors(this.stairFoot, this.stairTop, u);
    } else {
      const u = (t - 0.85) / 0.15;
      out.lerpVectors(this.stairTop, this.mozoleStop, u);
    }
    out.y = groundHeightAt(out.x, out.z);
  }

  private updateMarchPositions(t: number) {
    const center = new THREE.Vector3();
    this.samplePath(t, center);

    const yaw = this.phase === 'marching_out' ? 0 : Math.PI;
    this.bearers[0].group.position.set(center.x - 1.15, center.y, center.z);
    this.bearers[0].group.rotation.y = yaw;
    this.bearers[1].group.position.set(center.x + 1.15, center.y, center.z);
    this.bearers[1].group.rotation.y = yaw;

    // Commander marches slightly behind & to the right
    const cmdZ = this.phase === 'marching_out' ? center.z - 2.2 : center.z + 2.2;
    this.commander.group.position.set(center.x + 0.0, groundHeightAt(center.x, cmdZ), cmdZ);
    this.commander.group.rotation.y = yaw;

    if (this.carriedWreath.visible) {
      this.carriedWreath.position.set(center.x, center.y + 0.42, center.z - 0.55);
      this.carriedWreath.rotation.y = Math.PI;
    }
  }

  private applySoldierPose(
    rig: SoldierRig,
    dt: number,
    isMarching: boolean,
    shouldSalute: boolean,
    isCarrying: boolean,
  ) {
    const targetSalute = shouldSalute ? 1 : 0;
    const targetCarry = isCarrying ? 1 : 0;
    rig.saluteBlend += (targetSalute - rig.saluteBlend) * Math.min(1, dt * 10);
    rig.carryBlend += (targetCarry - rig.carryBlend) * Math.min(1, dt * 8);

    // Ceremonial march leg & arm swing
    if (isMarching) {
      const swing = Math.sin(this.walkPhase) * 0.58;
      rig.leftLeg.rotation.x = swing;
      rig.rightLeg.rotation.x = -swing;
      rig.leftArm.rotation.x = -swing * 0.65 * (1 - rig.carryBlend);
      rig.rightArm.rotation.x = swing * 0.65 * (1 - rig.carryBlend) * (1 - rig.saluteBlend);
    } else {
      rig.leftLeg.rotation.x *= 0.8;
      rig.rightLeg.rotation.x *= 0.8;
      rig.leftArm.rotation.x *= 0.8;
      if (rig.saluteBlend < 0.05 && rig.carryBlend < 0.05) {
        rig.rightArm.rotation.x *= 0.8;
      }
    }

    // Carrying wreath pose
    if (rig.carryBlend > 0.01 && rig.saluteBlend < 0.1) {
      rig.leftArm.rotation.x = THREE.MathUtils.lerp(rig.leftArm.rotation.x, -0.75, rig.carryBlend);
      rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, -0.75, rig.carryBlend);
      rig.leftForearm.rotation.x = THREE.MathUtils.lerp(0, -0.5, rig.carryBlend);
      rig.rightForearm.rotation.x = THREE.MathUtils.lerp(0, -0.5, rig.carryBlend);
    } else {
      rig.leftForearm.rotation.x *= 0.85;
    }

    // Crisp Military Salute (Asker Selami) on Right Arm
    if (rig.saluteBlend > 0.01) {
      // Raise upper arm forward & slightly outward, bend forearm sharply to cap visor
      rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, -1.65, rig.saluteBlend);
      rig.rightArm.rotation.z = THREE.MathUtils.lerp(0, -0.45, rig.saluteBlend);
      rig.rightForearm.rotation.x = THREE.MathUtils.lerp(0, -1.45, rig.saluteBlend);
      rig.rightForearm.rotation.z = THREE.MathUtils.lerp(0, 0.55, rig.saluteBlend);
    } else {
      rig.rightArm.rotation.z *= 0.82;
      if (rig.carryBlend < 0.05) {
        rig.rightForearm.rotation.x *= 0.82;
      }
      rig.rightForearm.rotation.z *= 0.82;
    }
  }

  public update(delta: number) {
    const dt = Math.min(delta, 0.05);

    if (this.manualSaluteTimer > 0) {
      this.manualSaluteTimer = Math.max(0, this.manualSaluteTimer - dt);
    }

    // Expire placed wreaths after 2 minutes (120 seconds)
    for (let i = this.placedWreaths.length - 1; i >= 0; i--) {
      const w = this.placedWreaths[i];
      w.age += dt;
      if (w.age >= 120) {
        this.placedWreathsGroup.remove(w.group);
        w.disposables.forEach((d) => d.dispose());
        this.placedWreaths.splice(i, 1);
      } else if (w.age > 118) {
        const s = Math.max(0.01, (120 - w.age) / 2);
        w.group.scale.setScalar(s);
      }
    }

    const ceremonySaluting = this.phase === 'saluting';
    const anySalute = ceremonySaluting || this.manualSaluteTimer > 0;

    // Update 2 permanent Mozole Sentries
    for (const s of this.sentries) {
      this.applySoldierPose(s, dt, false, anySalute, false);
    }

    if (this.phase === 'idle') return;

    this.phaseTimer += dt;

    if (this.phase === 'marching_in') {
      this.walkPhase += dt * 7.2;
      this.marchProgress = Math.min(1, this.marchProgress + dt * 0.11);
      this.updateMarchPositions(this.marchProgress);

      this.applySoldierPose(this.bearers[0], dt, true, false, true);
      this.applySoldierPose(this.bearers[1], dt, true, false, true);
      this.applySoldierPose(this.commander, dt, true, false, false);

      if (this.marchProgress >= 1) {
        this.phase = 'placing_wreath';
        this.phaseTimer = 0;
      }
    } else if (this.phase === 'placing_wreath') {
      const u = Math.min(1, this.phaseTimer / 1.4);
      // Lower wreath smoothly in front of the Ataturk Bust
      this.carriedWreath.position.y = THREE.MathUtils.lerp(4.22, 3.8, u);
      this.carriedWreath.position.z = THREE.MathUtils.lerp(-24.45, -24.85, u);

      this.bearers.forEach((b) => {
        b.torso.rotation.x = Math.sin(u * Math.PI) * 0.28;
        this.applySoldierPose(b, dt, false, false, u < 0.7);
      });
      this.applySoldierPose(this.commander, dt, false, false, false);

      if (this.phaseTimer >= 1.5) {
        this.bearers.forEach((b) => {
          b.torso.rotation.x = 0;
        });
        // Place the first wreath dead center right in front of the Ataturk Bust,
        // then fan subsequent wreaths symmetrically in front of the bust
        const permanent = this.createCeremonialWreath(this.currentDonor);
        const offsetCount = this.placedWreaths.length;
        let spreadX = 0;
        let spreadZ = -24.65;
        if (offsetCount > 0) {
          const side = offsetCount % 2 === 1 ? -1 : 1;
          const step = Math.ceil(offsetCount / 2);
          spreadX = side * ((step % 4) * 0.95);
          spreadZ = -24.65 + Math.floor(step / 4) * 0.65;
        }
        permanent.group.position.set(spreadX, 3.8, spreadZ);
        permanent.group.rotation.y = 0;
        this.placedWreathsGroup.add(permanent.group);
        this.placedWreaths.push({
          group: permanent.group,
          age: 0,
          disposables: permanent.localDisposables,
        });

        this.carriedWreath.visible = false;
        this.phase = 'saluting';
        this.phaseTimer = 0;
      }
    } else if (this.phase === 'saluting') {
      // All soldiers hold crisp military salute for 4 seconds
      this.applySoldierPose(this.bearers[0], dt, false, true, false);
      this.applySoldierPose(this.bearers[1], dt, false, true, false);
      this.applySoldierPose(this.commander, dt, false, true, false);

      if (this.phaseTimer >= 4.0) {
        this.phase = 'marching_out';
        this.phaseTimer = 0;
        this.marchProgress = 1;
      }
    } else if (this.phase === 'marching_out') {
      this.walkPhase += dt * 7.2;
      this.marchProgress = Math.max(0, this.marchProgress - dt * 0.13);
      this.updateMarchPositions(this.marchProgress);

      this.applySoldierPose(this.bearers[0], dt, true, false, false);
      this.applySoldierPose(this.bearers[1], dt, true, false, false);
      this.applySoldierPose(this.commander, dt, true, false, false);

      if (this.marchProgress <= 0) {
        this.phase = 'idle';
        this.bearers.forEach((b) => {
          b.group.visible = false;
        });
        this.commander.group.visible = false;
        const nextDonor = this.ceremonyQueue.shift();
        if (nextDonor) {
          this.startWreathCeremony(nextDonor);
        }
      }
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
