'use client';

/**
 * ─────────────────────────────────────────────────────────────
 *  مدل سه‌بعدی سنسور HC-SR04 در صحنه (مقیاس واقعی، سانتی‌متری)
 *  + کون اکوی زنده + برچسب فاصله + اتصال به دوقلوی دیجیتال
 * ─────────────────────────────────────────────────────────────
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { sensorRuntime } from '@/lib/sim/runtime';
import { useSimStore, type SensorInstance } from '@/lib/sim/store';

interface Props {
  sensor: SensorInstance;
}

export function SensorDevice3D({ sensor }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const coneRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const currentLen = useRef(0);
  const tool = useSimStore((s) => s.tool);
  const selected = useSimStore((s) => s.selectedId) === sensor.id;

  /* ساخت دوقلو + رجیستری */
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.userData.objectId = sensor.id;
    sensorRuntime.ensureTwin(sensor.id);
    sensorRuntime.registerMesh(sensor.id, g);
    return () => sensorRuntime.unregisterMesh(sensor.id);
  }, [sensor.id]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    sensorRuntime.updateSensorTransform(sensor.id, g);

    const twin = sensorRuntime.getTwin(sensor.id);
    if (!twin) return;

    const reading = twin.lastReading;
    const targetLen = reading && !reading.outOfRange && reading.distanceCm ? reading.distanceCm / 100 : 0;
    currentLen.current += (targetLen - currentLen.current) * 0.25;
    const len = Math.max(0.001, currentLen.current);

    const cone = coneRef.current;
    if (cone) {
      // مقیاس یکنواخت: ارتفاع = len، شعاع پایه = tan(15°)·len — apex روی سنسور
      cone.scale.setScalar(Math.max(0.02, len));
      cone.position.set(0, 0.001, len / 2);
      const mat = cone.material as THREE.MeshBasicMaterial;
      if (reading && reading.outOfRange) {
        mat.color.set('#ef4444');
        mat.opacity = 0.05;
      } else if (targetLen > 0) {
        mat.color.set('#34d399');
        mat.opacity = 0.14;
      } else {
        mat.opacity = 0.03;
      }
    }

    if (labelRef.current) {
      labelRef.current.textContent =
        reading && !reading.outOfRange && reading.distanceCm != null
          ? `${reading.distanceCm.toFixed(1)} cm`
          : '---';
    }
    if (dotRef.current) {
      const st = twin.state;
      dotRef.current.style.background =
        st === 'BURST' ? '#fbbf24' : st === 'LISTEN' ? '#34d399' : st === 'IDLE' ? '#71717a' : '#a1a1aa';
    }
  });

  const handlePointerDown = (e: { stopPropagation: () => void }) => {
    if (tool !== 'select' && tool !== 'move' && tool !== 'rotate' && tool !== 'scale') return;
    e.stopPropagation();
    useSimStore.getState().select(sensor.id);
  };

  const halfAngle = 15;

  return (
    <group
      ref={groupRef}
      position={sensor.position}
      rotation={[0, sensor.rotationY, 0]}
      onPointerDown={handlePointerDown}
    >
      {/* برد مدار چاپی آبی */}
      <mesh castShadow position={[0, 0.0008, 0]}>
        <boxGeometry args={[0.02, 0.0016, 0.045]} />
        <meshStandardMaterial
          color={selected ? '#2a7fd4' : '#1e5fa8'}
          roughness={0.55}
          metalness={0.15}
          emissive={selected ? '#10b981' : '#000000'}
          emissiveIntensity={selected ? 0.35 : 0}
        />
      </mesh>
      {/* چیپ کنترلر */}
      <mesh position={[0, 0.0026, -0.004]} castShadow>
        <boxGeometry args={[0.006, 0.002, 0.006]} />
        <meshStandardMaterial color="#14161a" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* ترنسدیوسرها T و R (قطر 16mm) */}
      {[-0.0125, 0.0125].map((z) => (
        <group key={z} position={[0, 0.0075, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.008, 0.008, 0.012, 24]} />
            <meshStandardMaterial color="#b9bec6" roughness={0.35} metalness={0.85} />
          </mesh>
          {/* مش بالایی */}
          <mesh position={[0, 0.0062, 0]}>
            <cylinderGeometry args={[0.0072, 0.0072, 0.0008, 24]} />
            <meshStandardMaterial color="#8d939c" roughness={0.5} metalness={0.6} />
          </mesh>
        </group>
      ))}
      {/* پین‌های هدر */}
      {[-0.00635, 0.00635].map((x) =>
        [-0.014, -0.0047, 0.0047, 0.014].map((z) => (
          <mesh key={`${x}_${z}`} position={[x, -0.0018, z]}>
            <boxGeometry args={[0.0006, 0.0035, 0.0006]} />
            <meshStandardMaterial color="#d4af37" roughness={0.3} metalness={0.9} />
          </mesh>
        )),
      )}

      {/* کون اکو (نمایش زنده‌ی فاصله) — هندسه‌ی واحد، اسکیل در useFrame */}
      <mesh ref={coneRef} position={[0, 0.001, 0.001]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[Math.tan((halfAngle * Math.PI) / 180), 1, 26, 1, true]} />
        <meshBasicMaterial
          color="#34d399"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* برچسب زنده */}
      <Html position={[0, 0.045, 0]} center distanceFactor={7} zIndexRange={[50, 0]}>
        <div
          dir="ltr"
          className="flex select-none items-center gap-1.5 rounded-md border border-zinc-700/80 bg-zinc-950/85 px-2 py-0.5 font-mono text-[11px] text-emerald-300 shadow-lg backdrop-blur-sm"
        >
          <span ref={dotRef} className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-500" />
          <span ref={labelRef}>---</span>
        </div>
      </Html>
    </group>
  );
}
