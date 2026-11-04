'use client';

/**
 * ─────────────────────────────────────────────────────────────
 *  Mesh یک شیء شبیه‌سازی — هندسه + متریال + فیزیک Rapier
 * ─────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { getMaterial } from '@/sensors/core/materials';
import { useSimStore, type SimObject } from '@/lib/sim/store';
import { sensorRuntime } from '@/lib/sim/runtime';

interface Props {
  obj: SimObject;
  /** کلید ریمانت (تغییر ترنسفورم → بدنه‌ی جدید فیزیک) */
  remountKey: string;
}

const RB_DYNAMIC = 0;
const RB_FIXED = 1;

export function SimObjectMesh({ obj, remountKey }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<RapierRigidBody>(null);
  const tool = useSimStore((s) => s.tool);
  const selectedId = useSimStore((s) => s.selectedId);
  const draggingId = useSimStore((s) => s.draggingId);
  const selected = selectedId === obj.id;

  const material = useMemo(() => getMaterial(obj.materialId), [obj.materialId]);

  /* رجیستری مش برای Raycasting آکوستیک */
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.userData.objectId = obj.id;
    g.userData.materialId = obj.materialId;
    sensorRuntime.registerMesh(obj.id, g);
    return () => sensorRuntime.unregisterMesh(obj.id);
  }, [obj.id, obj.materialId]);

  /* فریز فیزیک موقع جابجایی با گیزمو */
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !obj.dynamic) return;
    const frozen = draggingId === obj.id;
    const type = frozen ? RB_FIXED : RB_DYNAMIC;
    body.setBodyType(type as never, true);
    if (!frozen) {
      const g = groupRef.current;
      if (g) {
        const p = g.getWorldPosition(new THREE.Vector3());
        const q = g.getWorldQuaternion(new THREE.Quaternion());
        body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
        body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
        body.wakeUp();
      }
    }
  }, [draggingId, obj.id, obj.dynamic, remountKey]);

  /* کلیک تمیز در مقابل درگ دوربین — فقط با کلیک کوتاه انتخاب/اندازه‌گیری می‌شود */
  const downRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (tool === 'measure') {
      e.stopPropagation();
      downRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
      return;
    }
    const placementTools = ['plan', 'wall', 'box', 'sphere', 'cylinder', 'addSensor'];
    if (placementTools.includes(tool)) {
      return; // اجازه‌ی عبور به صفحه‌ی قرارگیری
    }
    e.stopPropagation();
    downRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    const down = downRef.current;
    downRef.current = null;
    if (!down) return;
    // درگ = چرخش دوربین — انتخاب/اندازه‌گیری انجام نشود
    const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const dt = performance.now() - down.t;
    if (dist > 6 || dt > 650) return;

    if (tool === 'measure') {
      useSimStore.getState().addMeasurePoint([e.point.x, e.point.y, e.point.z]);
      return;
    }
    if (tool === 'select' || tool === 'move' || tool === 'rotate' || tool === 'scale') {
      useSimStore.getState().select(obj.id);
    }
  };

  const geometry = useMemo(() => {
    switch (obj.kind) {
      case 'sphere':
        return <sphereGeometry args={[0.5, 32, 24]} />;
      case 'cylinder':
        return <cylinderGeometry args={[0.5, 0.5, 1, 28]} />;
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  }, [obj.kind]);

  const isDynamic = obj.dynamic && obj.id !== 'ground';

  return (
    <RigidBody
      key={remountKey}
      ref={bodyRef}
      type={isDynamic ? 'dynamic' : 'fixed'}
      colliders={obj.kind === 'sphere' ? 'ball' : 'cuboid'}
      position={obj.position}
      rotation={obj.rotation}
      friction={0.85}
      restitution={0.08}
      linearDamping={0.05}
      angularDamping={0.1}
    >
      <group ref={groupRef} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
        <mesh castShadow receiveShadow scale={obj.scale}>
          {geometry}
          <meshStandardMaterial
            color={material.color}
            roughness={material.roughness}
            metalness={material.metalness}
            emissive={selected ? '#10b981' : '#000000'}
            emissiveIntensity={selected ? 0.28 : 0}
          />
        </mesh>
      </group>
    </RigidBody>
  );
}
