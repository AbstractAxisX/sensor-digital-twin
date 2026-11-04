'use client';

/**
 * ─────────────────────────────────────────────────────────────
 *  مدل سه‌بعدی سنسور HC-SR04 در صحنه
 *  • مدل فیزیکی µs-دقیق در مقیاس واقعی می‌ماند (۴۵×۲۰mm)
 *  • نمایش بصری با ضریب VIS بزرگ می‌شود تا خوانا و قابل‌کلیک باشد
 *  • استند سه‌پایه + حباب کلیک بزرگ + برچسب ثابت + کون اکوی زنده
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

/** ضریب بزرگ‌نمایی «نمایشی» برد سنسور (فیزیک آکوستیک مستقل از این است) */
const VIS = 4;
/** فاصله‌ی صفحه‌ی ترنسدیوسرها از مرکز گروه (بعد از اسکیل) */
const FACE_Z = 0.0125 * VIS + 0.006;

export function SensorDevice3D({ sensor }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const acousticRef = useRef<THREE.Group>(null);
  const coneRef = useRef<THREE.Mesh>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const stateRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const currentLen = useRef(0);
  const tool = useSimStore((s) => s.tool);
  const selected = useSimStore((s) => s.selectedId) === sensor.id;

  /* ساخت دوقلو + رجیستری (مش آکوستیک جدا از گروه اصلی) */
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.userData.objectId = sensor.id;
    sensorRuntime.ensureTwin(sensor.id);
    sensorRuntime.registerMesh(sensor.id, g, acousticRef.current ?? g);
    return () => {
      sensorRuntime.unregisterMesh(sensor.id);
      sensorRuntime.removeTwin(sensor.id);
    };
  }, [sensor.id]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    sensorRuntime.updateSensorTransform(sensor.id, g);

    const twin = sensorRuntime.getTwin(sensor.id);
    if (!twin) return;

    const reading = twin.lastReading;
    const targetLen =
      reading && !reading.outOfRange && reading.distanceCm ? reading.distanceCm / 100 : 0;
    currentLen.current += (targetLen - currentLen.current) * 0.22;
    const len = Math.max(0.001, currentLen.current);

    const cone = coneRef.current;
    if (cone) {
      const showCone = targetLen > 0 || Math.abs(currentLen.current) > 0.05;
      cone.visible = showCone;
      // مقیاس یکنواخت: ارتفاع = len، شعاع پایه = tan(15°)·len — رأس روی Face سنسور
      cone.scale.setScalar(Math.max(0.02, len));
      cone.position.set(0, 0.001, FACE_Z + len / 2);
      const mat = cone.material as THREE.MeshBasicMaterial;
      if (reading && reading.outOfRange) {
        mat.color.set('#ef4444');
        mat.opacity = 0.07;
      } else if (targetLen > 0) {
        mat.color.set('#34d399');
        mat.opacity = 0.16;
      } else {
        mat.opacity = 0.04;
      }
    }

    if (valueRef.current) {
      valueRef.current.textContent =
        reading && !reading.outOfRange && reading.distanceCm != null
          ? reading.distanceCm.toFixed(1)
          : reading?.outOfRange
            ? 'OUT'
            : '---';
    }
    if (stateRef.current) {
      stateRef.current.textContent = twin.stateFa;
    }
    if (dotRef.current) {
      const st = twin.state;
      dotRef.current.style.background =
        st === 'BURST' ? '#fbbf24' : st === 'LISTEN' ? '#34d399' : st === 'IDLE' ? '#71717a' : '#a1a1aa';
    }
  });

  const handlePointerDown = (e: { stopPropagation: () => void }) => {
    if (tool === 'measure' || (tool !== 'select' && tool !== 'move' && tool !== 'rotate' && tool !== 'scale')) return;
    e.stopPropagation();
    useSimStore.getState().select(sensor.id);
  };

  const py = Math.max(0.03, sensor.position[1]);
  const halfAngle = 15;

  return (
    <group
      ref={groupRef}
      position={sensor.position}
      rotation={[0, sensor.rotationY, 0]}
      onPointerDown={handlePointerDown}
    >
      {/* ── استند: پایه + میله (فقط وقتی سنسور شناور است) ── */}
      {py > 0.06 && (
        <>
          <mesh position={[0, -py + 0.005, 0]} castShadow>
            <cylinderGeometry args={[0.085, 0.1, 0.01, 28]} />
            <meshStandardMaterial color="#27272a" roughness={0.7} metalness={0.2} />
          </mesh>
          <mesh position={[0, -py / 2, 0]} castShadow>
            <cylinderGeometry args={[0.008, 0.01, py, 14]} />
            <meshStandardMaterial color="#3f3f46" roughness={0.5} metalness={0.6} />
          </mesh>
        </>
      )}

      {/* ── حلقه‌ی انتخاب ── */}
      {selected && (
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.13, 0.006, 10, 48]} />
          <meshBasicMaterial color="#34d399" transparent opacity={0.9} />
        </mesh>
      )}

      {/* ── حباب کلیک بزرگ (نامرئی ولی Raycast-پذیر) — خارج از رجیستری آکوستیک ── */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.16, 12, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* ── کون اکو (نمایش زنده‌ی فاصله) — فیزیکی، بی‌اسکیل ── */}
      <mesh ref={coneRef} position={[0, 0.001, FACE_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[Math.tan((halfAngle * Math.PI) / 180), 1, 26, 1, true]} />
        <meshBasicMaterial
          color="#34d399"
          transparent
          opacity={0.14}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* ── برچسب زنده (اندازه‌ی ثابت روی صفحه) ── */}
      <Html position={[0, 0.085, 0]} center zIndexRange={[50, 0]} pointerEvents="none">
        <div
          dir="ltr"
          className="flex w-max select-none flex-col items-center gap-0.5 rounded-lg border border-zinc-700/80 bg-zinc-950/90 px-2.5 py-1 shadow-xl backdrop-blur-sm"
        >
          <div className="flex items-center gap-1.5 font-mono text-lg font-bold leading-5 text-emerald-300">
            <span ref={dotRef} className="inline-block h-2 w-2 rounded-full bg-zinc-500" />
            <span ref={valueRef}>---</span>
            <span className="text-[10px] font-normal text-zinc-500">cm</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] leading-3 text-zinc-400">
            <span>{sensor.name}</span>
            <span className="text-zinc-600">·</span>
            <span ref={stateRef} className="text-zinc-500">
              ---
            </span>
          </div>
        </div>
      </Html>

      {/* ── برد سنسور (بزرگ‌نمایی نمایشی ×۴) — رجیستری آکوستیک ── */}
      <group ref={acousticRef} scale={VIS}>
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
      </group>
    </group>
  );
}
