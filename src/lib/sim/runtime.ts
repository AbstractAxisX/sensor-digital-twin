/**
 * ─────────────────────────────────────────────────────────────
 *  WaveLab Runtime — پل بین دنیای سه‌بعدی و دوقلوهای سنسور
 *  • رجیستری مش‌های صحنه (برای Raycasting آکوستیک)
 *  • مدیریت دوقلوهای سنسورهای قرار داده شده در صحنه
 *  • محاسبه‌ی کاندیداهای اکو با فیزیک واقعی (کون ±15°، ۲۹ پرتو)
 * ─────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';
import { HCSR04Twin } from '@/sensors/hc-sr04/HCSR04Twin';
import {
  coneDirections,
  echoAmplitude,
  groupEchos,
} from '@/sensors/core/acoustic';
import { getMaterial } from '@/sensors/core/materials';
import type { EchoCandidate } from '@/sensors/core/types';
import { useSimStore } from './store';

const RAY_COUNT = 29;
const HALF_ANGLE_DEG = 15;

interface SensorRuntimeEntry {
  twin: HCSR04Twin;
  /** ترنسفورم لحظه‌ای سنسور (هر فریم به‌روز می‌شود) */
  position: THREE.Vector3;
  forward: THREE.Vector3;
  lastAutoTrigMs: number;
}

class SensorRuntime {
  private entries = new Map<string, SensorRuntimeEntry>();
  private meshes = new Map<string, THREE.Object3D>();
  private registryListeners = new Set<() => void>();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private raycaster = new THREE.Raycaster();
  private rayDirs = coneDirections(RAY_COUNT, HALF_ANGLE_DEG).map(({ thetaDeg, phiDeg }) => {
    const th = (thetaDeg * Math.PI) / 180;
    const ph = (phiDeg * Math.PI) / 180;
    return new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th));
  });

  /* ── رجیستری مش‌ها ── */
  registerMesh(id: string, obj: THREE.Object3D) {
    this.meshes.set(id, obj);
    this.notifyRegistry();
  }
  unregisterMesh(id: string) {
    this.meshes.delete(id);
    this.notifyRegistry();
  }
  getMesh(id: string): THREE.Object3D | undefined {
    return this.meshes.get(id);
  }
  /** اشتراک در تغییرات رجیستری (برای UI واکنشی مثل گیزمو) */
  onRegistryChange(fn: () => void): () => void {
    this.registryListeners.add(fn);
    return () => {
      this.registryListeners.delete(fn);
    };
  }
  private notifyRegistry() {
    for (const fn of this.registryListeners) fn();
  }

  /* ── دوقلوهای صحنه ── */
  ensureTwin(sensorId: string): HCSR04Twin {
    let entry = this.entries.get(sensorId);
    if (!entry) {
      const twin = new HCSR04Twin({
        provideEchos: () => this.computeEchoCandidates(sensorId),
        getEnvironment: () => useSimStore.getState().env,
      });
      entry = {
        twin,
        position: new THREE.Vector3(),
        forward: new THREE.Vector3(0, 0, 1),
        lastAutoTrigMs: 0,
      };
      this.entries.set(sensorId, entry);
    }
    return entry.twin;
  }

  getTwin(sensorId: string): HCSR04Twin | undefined {
    return this.entries.get(sensorId)?.twin;
  }

  removeTwin(sensorId: string) {
    this.entries.delete(sensorId);
  }

  /** به‌روزرسانی ترنسفورم سنسور (از کامپوننت سه‌بعدی هر فریم) */
  updateSensorTransform(sensorId: string, obj: THREE.Object3D) {
    const entry = this.entries.get(sensorId);
    if (!entry) return;
    obj.getWorldPosition(entry.position);
    entry.forward.set(0, 0, 1).applyQuaternion(obj.getWorldQuaternion(this.tmpQ)).normalize();
  }

  /**
   * پرتاب ۲۹ پرتو داخل کون ±15° و محاسبه‌ی کاندیداهای اکو
   * با مدل فیزیکی کامل: بیتام، بازتاب متریال، زاویه‌ی تابشی، جذب هوا، معکوس مجذور
   */
  computeEchoCandidates(sensorId: string): EchoCandidate[] {
    const entry = this.entries.get(sensorId);
    if (!entry) return [];
    const store = useSimStore.getState();
    const env = store.env;

    // مش‌های قابل برخورد (به جز خود سنسور)
    const collidables: THREE.Object3D[] = [];
    for (const [id, mesh] of this.meshes) {
      if (id === sensorId) continue;
      if (mesh.visible) collidables.push(mesh);
    }
    if (collidables.length === 0) return [];

    const rays: EchoCandidate[] = [];
    this.raycaster.far = 6;
    this.raycaster.near = 0.005;

    for (const localDir of this.rayDirs) {
      const dir = localDir.clone().applyQuaternion(this.tmpQ.setFromUnitVectors(new THREE.Vector3(0, 0, 1), entry.forward));
      this.raycaster.set(entry.position, dir);
      const hits = this.raycaster.intersectObjects(collidables, true);
      if (hits.length === 0) continue;
      const hit = hits[0];
      if (!hit.face) continue;

      // شناسه‌ی شیء از userData (با پیمایش والدین)
      let objectId: string | undefined;
      let materialId: string | undefined;
      let node: THREE.Object3D | null = hit.object;
      while (node) {
        if (!objectId && node.userData?.objectId) objectId = node.userData.objectId as string;
        if (!materialId && node.userData?.materialId) materialId = node.userData.materialId as string;
        node = node.parent;
      }
      if (!objectId) continue;

      // نرمال سطح در فضای جهانی
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      const incidenceCos = Math.abs(normal.dot(dir));

      const angleDeg = (Math.acos(Math.min(1, Math.max(-1, dir.dot(entry.forward)))) * 180) / Math.PI;
      const mat = getMaterial(materialId ?? 'concrete');

      const amplitude = echoAmplitude({
        distanceM: hit.distance,
        angleDeg,
        materialAcoustic: mat.acoustic,
        incidenceCos,
        env,
      });

      rays.push({
        objectId,
        materialId: mat.id,
        distanceM: hit.distance,
        angleDeg,
        amplitude,
      });
    }

    return groupEchos(rays);
  }

  /** پیشبرد همه‌ی دوقلوها — از useFrame صحنه صدا زده می‌شود (ms) */
  update(nowMs: number) {
    const store = useSimStore.getState();
    const tUs = nowMs * 1000;
    for (const [id, entry] of this.entries) {
      const sensor = store.sensors[id];
      if (!sensor) continue;
      if (sensor.autoRun && nowMs - entry.lastAutoTrigMs >= sensor.cycleMs) {
        entry.lastAutoTrigMs = nowMs;
        entry.twin.triggerPulse(tUs);
      }
      entry.twin.update(tUs);
    }
  }
}

export const sensorRuntime = new SensorRuntime();

/* هوک دیباگ برای کنسول مرورگر (فقط توسعه) */
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as Record<string, unknown>).__wavelab = {
    sensorRuntime,
    useSimStore,
  };
}
