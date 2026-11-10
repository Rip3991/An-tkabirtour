import * as THREE from 'three';
import type { Visitor } from '../types';
import { groundHeightAt } from './anitkabirBuilder';
import { createContactShadowTexture } from './textures';

export interface ProjectedLabel {
  id: string;
  username: string;
  message?: string;
  giftName?: string;
  giftTier: number;
  x: number;
  y: number;
  visible: boolean;
}

interface AvatarInstance {
  visitor: Visitor;
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  torso: THREE.Mesh;
  handFlower: THREE.Group;
  waypoints: THREE.Vector3[];
  waypointIndex: number;
  walkPhase: number;
  speed: number;
  phase: 'walking_to_flower' | 'laying_flower' | 'walking_to_slot' | 'standing';
  layTimer: number;
  flowerPlaced: boolean;
  disposables: Array<{ dispose: () => void }>;
}

const _tmpVec = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _dirVec = new THREE.Vector3();

const FLOWER_COLORS = [0xdc2626, 0xf43f5e, 0xfef2f2, 0xfb7185, 0xe11d48];

export class VisitorManager {
  public readonly root = new THREE.Group();
  private flowerBedGroup = new THREE.Group();
  private avatars = new Map<string, AvatarInstance>();
  private placedFlowerIds = new Set<string>();
  private flowerDisposables: Array<{ dispose: () => void }> = [];

  private shadowTex: THREE.CanvasTexture;
  private sharedShadowGeo = new THREE.PlaneGeometry(0.95, 0.95);
  private sharedLegGeo = new THREE.BoxGeometry(0.16, 0.56, 0.18);
  private sharedArmGeo = new THREE.BoxGeometry(0.13, 0.48, 0.14);
  private sharedTorsoGeo = new THREE.BoxGeometry(0.42, 0.58, 0.24);
  private sharedHeadGeo = new THREE.SphereGeometry(0.16, 12, 12);
  private sharedHairGeo = new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
  private sharedRingGeo = new THREE.RingGeometry(0.42, 0.55, 24);
  private sharedStemGeo = new THREE.CylinderGeometry(0.025, 0.02, 0.28, 6);
  private sharedBloomGeo = new THREE.DodecahedronGeometry(0.08, 0);
  private sharedWreathGeo = new THREE.TorusGeometry(0.24, 0.055, 8, 16);
  private sharedLeafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b33, roughness: 0.8 });

  private latestVisitorId: string | null = null;

  constructor() {
    this.shadowTex = createContactShadowTexture();
    this.sharedShadowGeo.rotateX(-Math.PI / 2);
    this.sharedRingGeo.rotateX(-Math.PI / 2);
    this.root.add(this.flowerBedGroup);
  }

  public getLatestVisitorPosition(out: THREE.Vector3): boolean {
    if (!this.latestVisitorId) return false;
    const inst = this.avatars.get(this.latestVisitorId);
    if (!inst) return false;
    out.copy(inst.group.position);
    return true;
  }

  public getLatestVisitorTransform(posOut: THREE.Vector3): { yaw: number; found: boolean } {
    if (!this.latestVisitorId) return { yaw: Math.PI, found: false };
    const inst = this.avatars.get(this.latestVisitorId);
    if (!inst) return { yaw: Math.PI, found: false };
    posOut.copy(inst.group.position);
    return { yaw: inst.group.rotation.y, found: true };
  }

  private createHandFlower(giftTier: number, disposables: Array<{ dispose: () => void }>): THREE.Group {
    const fGroup = new THREE.Group();
    if (giftTier >= 3) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xb45309,
        emissiveIntensity: 0.35,
        roughness: 0.35,
        metalness: 0.6,
      });
      const wreath = new THREE.Mesh(this.sharedWreathGeo, mat);
      wreath.scale.setScalar(0.72);
      fGroup.add(wreath);
      disposables.push(mat);
    } else {
      const stem = new THREE.Mesh(this.sharedStemGeo, this.sharedLeafMat);
      stem.rotation.x = Math.PI / 3;
      const color =
        giftTier === 2
          ? 0xf97316
          : FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)];
      const bloomMat = new THREE.MeshStandardMaterial({
        color,
        emissive: giftTier === 2 ? 0xc2410c : 0x000000,
        emissiveIntensity: 0.35,
        roughness: 0.55,
      });
      const bloom = new THREE.Mesh(this.sharedBloomGeo, bloomMat);
      bloom.position.set(0, 0.08, 0.14);
      fGroup.add(stem, bloom);
      disposables.push(bloomMat);
    }
    return fGroup;
  }

  private placeFlowerOnGround(visitor: Visitor) {
    const spot = visitor.flowerSpot;
    const flowerKey = `${visitor.id}-${spot.x.toFixed(2)}-${spot.z.toFixed(2)}`;
    if (this.placedFlowerIds.has(flowerKey)) return;
    this.placedFlowerIds.add(flowerKey);

    const fGroup = new THREE.Group();
    fGroup.position.set(spot.x, groundHeightAt(spot.x, spot.z) + 0.03, spot.z);
    fGroup.rotation.y = (Math.random() - 0.5) * 0.9;

    if (visitor.giftTier >= 3) {
      // Ceremonial Golden/Red Wreath leaning slightly
      const wreathMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0x92400e,
        emissiveIntensity: 0.25,
        roughness: 0.38,
        metalness: 0.5,
      });
      const wreath = new THREE.Mesh(this.sharedWreathGeo, wreathMat);
      wreath.rotation.x = -Math.PI / 2.6;
      wreath.position.y = 0.16;
      wreath.castShadow = true;
      fGroup.add(wreath);
      this.flowerDisposables.push(wreathMat);
    } else {
      // Bouquet of 3 carnations/roses lying on the stone terrace
      const color =
        visitor.giftTier === 2
          ? 0xf97316
          : FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)];
      const bloomMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.55,
      });
      this.flowerDisposables.push(bloomMat);

      for (let i = 0; i < 3; i++) {
        const stem = new THREE.Mesh(this.sharedStemGeo, this.sharedLeafMat);
        stem.rotation.x = Math.PI / 2 - 0.08;
        stem.rotation.z = (i - 1) * 0.22;
        stem.position.set((i - 1) * 0.06, 0.03, 0.05);

        const bloom = new THREE.Mesh(this.sharedBloomGeo, bloomMat);
        bloom.position.set((i - 1) * 0.09, 0.06, -0.1);
        bloom.castShadow = true;
        fGroup.add(stem, bloom);
      }
    }

    this.flowerBedGroup.add(fGroup);
  }

  public addOrUpdateVisitor(visitor: Visitor, skipWalkIfInitial = false) {
    const existing = this.avatars.get(visitor.id);
    if (existing) {
      const prevFlowerZ = existing.visitor.flowerSpot.z;
      const prevFlowerX = existing.visitor.flowerSpot.x;
      existing.visitor = visitor;
      this.latestVisitorId = visitor.id;
      if (
        existing.phase === 'standing' &&
        (Math.abs(prevFlowerX - visitor.flowerSpot.x) > 0.01 ||
          Math.abs(prevFlowerZ - visitor.flowerSpot.z) > 0.01)
      ) {
        const f = visitor.flowerSpot;
        existing.waypoints = [
          new THREE.Vector3(f.x, 0.2, -10.5),
          new THREE.Vector3(f.x, 2.0, -17.0),
          new THREE.Vector3(f.x, 3.8, -22.2),
          new THREE.Vector3(f.x, 3.8, f.z + 0.7),
        ];
        existing.waypointIndex = 0;
        existing.phase = 'walking_to_flower';
        existing.flowerPlaced = false;
        existing.handFlower.visible = true;
      }
      return;
    }

    const group = new THREE.Group();
    const disposables: Array<{ dispose: () => void }> = [];

    const outfitMat = new THREE.MeshStandardMaterial({
      color: visitor.outfitColor,
      roughness: 0.78,
      metalness: 0.05,
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x22262d,
      roughness: 0.85,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: visitor.skinTone,
      roughness: 0.68,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: visitor.hairColor,
      roughness: 0.85,
    });
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.6,
    });
    disposables.push(outfitMat, pantsMat, skinMat, hairMat, shadowMat);

    // Contact shadow
    const shadow = new THREE.Mesh(this.sharedShadowGeo, shadowMat);
    shadow.position.y = 0.02;
    group.add(shadow);

    // VIP halo ring for gift givers
    if (visitor.giftTier > 0) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: visitor.giftTier >= 3 ? 0xf59e0b : visitor.giftTier === 2 ? 0xef4444 : 0x38bdf8,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(this.sharedRingGeo, ringMat);
      ring.position.y = 0.03;
      group.add(ring);
      disposables.push(ringMat);
    }

    // Legs
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.11, 0.56, 0);
    const leftLegMesh = new THREE.Mesh(this.sharedLegGeo, pantsMat);
    leftLegMesh.position.y = -0.28;
    leftLegMesh.castShadow = true;
    leftLeg.add(leftLegMesh);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.11, 0.56, 0);
    const rightLegMesh = new THREE.Mesh(this.sharedLegGeo, pantsMat);
    rightLegMesh.position.y = -0.28;
    rightLegMesh.castShadow = true;
    rightLeg.add(rightLegMesh);

    // Torso
    const torso = new THREE.Mesh(this.sharedTorsoGeo, outfitMat);
    torso.position.y = 0.86;
    torso.castShadow = true;

    // Arms
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.28, 1.1, 0);
    const leftArmMesh = new THREE.Mesh(this.sharedArmGeo, outfitMat);
    leftArmMesh.position.y = -0.22;
    leftArmMesh.castShadow = true;
    leftArm.add(leftArmMesh);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.28, 1.1, 0);
    const rightArmMesh = new THREE.Mesh(this.sharedArmGeo, outfitMat);
    rightArmMesh.position.y = -0.22;
    rightArmMesh.castShadow = true;
    rightArm.add(rightArmMesh);

    // Every visitor carries a flower bouquet (or wreath) to lay before the Mozole
    const handFlower = this.createHandFlower(visitor.giftTier, disposables);
    handFlower.position.set(0, -0.44, 0.1);
    rightArm.add(handFlower);

    // Head & Hair / Hat Style
    const head = new THREE.Mesh(this.sharedHeadGeo, skinMat);
    head.position.y = 1.32;
    head.castShadow = true;

    const hair = new THREE.Mesh(this.sharedHairGeo, hairMat);
    hair.position.y = 1.35;
    group.add(leftLeg, rightLeg, torso, leftArm, rightArm, head, hair);

    const style = visitor.hairStyle || 'short';
    if (style === 'long') {
      const longGeo = new THREE.BoxGeometry(0.32, 0.28, 0.14);
      const longHair = new THREE.Mesh(longGeo, hairMat);
      longHair.position.set(0, 1.24, -0.1);
      group.add(longHair);
      disposables.push(longGeo);
    } else if (style === 'bun') {
      const bunGeo = new THREE.SphereGeometry(0.08, 10, 10);
      const bun = new THREE.Mesh(bunGeo, hairMat);
      bun.position.set(0, 1.46, -0.14);
      group.add(bun);
      disposables.push(bunGeo);
    } else if (style === 'cap') {
      const capMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
      const visorGeo = new THREE.BoxGeometry(0.24, 0.03, 0.16);
      const visor = new THREE.Mesh(visorGeo, capMat);
      visor.position.set(0, 1.41, 0.16);
      group.add(visor);
      disposables.push(capMat, visorGeo);
    } else if (style === 'kalpak') {
      const kalpakGeo = new THREE.CylinderGeometry(0.18, 0.195, 0.22, 14);
      const kalpakMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.92 });
      const kalpak = new THREE.Mesh(kalpakGeo, kalpakMat);
      kalpak.position.set(0, 1.47, 0);
      kalpak.castShadow = true;
      group.add(kalpak);
      disposables.push(kalpakGeo, kalpakMat);
    }

    const waypoints = this.buildWaypointsToFlower(visitor);
    if (skipWalkIfInitial) {
      const s = visitor.targetSlot;
      group.position.set(s.x, groundHeightAt(s.x, s.z), s.z);
      group.rotation.y = Math.PI;
      handFlower.visible = false;
      this.placeFlowerOnGround(visitor);
    } else {
      const start = waypoints[0];
      group.position.set(start.x, groundHeightAt(start.x, start.z), start.z);
    }

    this.root.add(group);
    this.avatars.set(visitor.id, {
      visitor,
      group,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      torso,
      handFlower,
      waypoints,
      waypointIndex: skipWalkIfInitial ? waypoints.length : 1,
      walkPhase: Math.random() * Math.PI * 2,
      speed: visitor.giftTier >= 2 ? 6.2 : 5.4 + Math.random() * 0.6,
      phase: skipWalkIfInitial ? 'standing' : 'walking_to_flower',
      layTimer: 0,
      flowerPlaced: skipWalkIfInitial,
      disposables,
    });
    this.latestVisitorId = visitor.id;
  }

  private buildWaypointsToFlower(visitor: Visitor): THREE.Vector3[] {
    const f = visitor.flowerSpot;
    const laneOffset = (Math.random() - 0.5) * 4.5;
    const pts: THREE.Vector3[] = [];

    if (visitor.spawnRoute === 'aslanli') {
      pts.push(new THREE.Vector3(54 + Math.random() * 8, 0.2, 6 + laneOffset));
      pts.push(new THREE.Vector3(28, 0.2, 6 + laneOffset * 0.4));
    } else {
      pts.push(new THREE.Vector3((Math.random() - 0.5) * 14, 0.2, 14));
    }

    // Walk to foot of Mozole stairs, climb up to the Ataturk Bust flower bed
    pts.push(new THREE.Vector3(f.x, 0.2, -10.5));
    pts.push(new THREE.Vector3(f.x, 2.0, -17.0));
    pts.push(new THREE.Vector3(f.x, 3.8, -22.2));
    pts.push(new THREE.Vector3(f.x, 3.8, f.z + 0.7));
    return pts;
  }

  public removeVisitor(visitorId: string) {
    const inst = this.avatars.get(visitorId);
    if (!inst) return;
    this.root.remove(inst.group);
    inst.disposables.forEach((d) => d.dispose());
    this.avatars.delete(visitorId);
  }

  public clearAll() {
    for (const id of Array.from(this.avatars.keys())) {
      this.removeVisitor(id);
    }
    while (this.flowerBedGroup.children.length > 0) {
      this.flowerBedGroup.remove(this.flowerBedGroup.children[0]);
    }
    this.flowerDisposables.forEach((d) => d.dispose());
    this.flowerDisposables = [];
    this.placedFlowerIds.clear();
    this.latestVisitorId = null;
  }

  public update(delta: number, elapsed: number) {
    const dt = Math.min(delta, 0.05);

    for (const inst of this.avatars.values()) {
      if (inst.phase === 'walking_to_flower' || inst.phase === 'walking_to_slot') {
        const target = inst.waypoints[inst.waypointIndex];
        if (!target) {
          inst.phase = 'standing';
          continue;
        }
        _dirVec.set(target.x - inst.group.position.x, 0, target.z - inst.group.position.z);
        const dist = _dirVec.length();

        if (dist < 0.22) {
          inst.waypointIndex++;
          if (inst.waypointIndex >= inst.waypoints.length) {
            if (inst.phase === 'walking_to_flower') {
              inst.phase = 'laying_flower';
              inst.layTimer = 0;
            } else {
              inst.phase = 'standing';
            }
          }
        } else {
          _dirVec.divideScalar(dist);
          const step = Math.min(dist, inst.speed * dt);
          inst.group.position.x += _dirVec.x * step;
          inst.group.position.z += _dirVec.z * step;
          inst.group.position.y = groundHeightAt(inst.group.position.x, inst.group.position.z);

          const desiredYaw = Math.atan2(_dirVec.x, _dirVec.z);
          let diff = desiredYaw - inst.group.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          inst.group.rotation.y += diff * Math.min(1, dt * 8);

          inst.walkPhase += dt * inst.speed * 2.4;
          const swing = Math.sin(inst.walkPhase) * 0.55;
          inst.leftLeg.rotation.x = swing;
          inst.rightLeg.rotation.x = -swing;
          inst.leftArm.rotation.x = -swing * 0.65;
          inst.rightArm.rotation.x = inst.flowerPlaced ? swing * 0.65 : -0.45 + swing * 0.15;
          inst.torso.position.y = 0.86 + Math.abs(Math.cos(inst.walkPhase)) * 0.03;
        }
      } else if (inst.phase === 'laying_flower') {
        // Face Mozole (-Z) and bow/extend right arm to place the flower
        let diff = Math.PI - inst.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        inst.group.rotation.y += diff * Math.min(1, dt * 8);

        inst.layTimer += dt;
        inst.leftLeg.rotation.x *= 0.85;
        inst.rightLeg.rotation.x *= 0.85;
        inst.torso.rotation.x = Math.sin(Math.min(1, inst.layTimer / 0.8) * Math.PI) * 0.35;
        inst.rightArm.rotation.x = -1.1 * Math.sin(Math.min(1, inst.layTimer / 0.8) * Math.PI);

        if (inst.layTimer >= 0.45 && !inst.flowerPlaced) {
          inst.flowerPlaced = true;
          inst.handFlower.visible = false;
          this.placeFlowerOnGround(inst.visitor);
        }

        if (inst.layTimer >= 0.85) {
          inst.torso.rotation.x = 0;
          inst.rightArm.rotation.x = 0;
          const s = inst.visitor.targetSlot;
          inst.waypoints = [
            new THREE.Vector3(s.x, 3.8, -22.2),
            new THREE.Vector3(s.x, 2.0, -17.0),
            new THREE.Vector3(s.x, 0.2, -10.5),
            new THREE.Vector3(s.x, groundHeightAt(s.x, s.z), s.z),
          ];
          inst.waypointIndex = 0;
          inst.phase = 'walking_to_slot';
        }
      } else {
        // Standing respectfully facing the Mozole (-Z -> yaw = Math.PI)
        let diff = Math.PI - inst.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        inst.group.rotation.y += diff * Math.min(1, dt * 5);

        inst.leftLeg.rotation.x *= 0.85;
        inst.rightLeg.rotation.x *= 0.85;
        inst.leftArm.rotation.x *= 0.85;
        inst.rightArm.rotation.x *= 0.85;
        inst.torso.position.y = 0.86 + Math.sin(elapsed * 1.8 + inst.walkPhase) * 0.01;
      }
    }
  }

  public projectLabels(
    camera: THREE.Camera,
    width: number,
    height: number,
    maxLabels = 18,
  ): ProjectedLabel[] {
    const list = Array.from(this.avatars.values());
    list.sort(
      (a, b) =>
        b.visitor.joinedAt +
        b.visitor.giftTier * 30_000 -
        (a.visitor.joinedAt + a.visitor.giftTier * 30_000),
    );

    const results: ProjectedLabel[] = [];
    const subset = list.slice(0, maxLabels);

    for (const inst of subset) {
      _tmpVec.set(
        inst.group.position.x,
        inst.group.position.y + 1.85,
        inst.group.position.z,
      );
      const distToCam = _tmpVec.distanceTo(camera.position);
      if (distToCam > 105) continue;

      _projVec.copy(_tmpVec).project(camera);
      if (_projVec.z > 1 || _projVec.z < -1) continue;

      const sx = ((_projVec.x + 1) / 2) * width;
      const sy = (-(_projVec.y - 1) / 2) * height;
      if (sx < 20 || sx > width - 20 || sy < 20 || sy > height - 80) continue;

      results.push({
        id: inst.visitor.id,
        username: inst.visitor.username,
        message: inst.visitor.message,
        giftName: inst.visitor.giftName,
        giftTier: inst.visitor.giftTier,
        x: sx,
        y: sy,
        visible: true,
      });
    }

    return results;
  }

  public dispose() {
    this.clearAll();
    this.shadowTex.dispose();
    this.sharedShadowGeo.dispose();
    this.sharedLegGeo.dispose();
    this.sharedArmGeo.dispose();
    this.sharedTorsoGeo.dispose();
    this.sharedHeadGeo.dispose();
    this.sharedHairGeo.dispose();
    this.sharedRingGeo.dispose();
    this.sharedStemGeo.dispose();
    this.sharedBloomGeo.dispose();
    this.sharedWreathGeo.dispose();
    this.sharedLeafMat.dispose();
  }
}
