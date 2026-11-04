'use client';

/**
 * ─────────────────────────────────────────────────────────────
 *  ViewportCanvas — قلب موتور WaveLab
 *  رندر Three.js + فیزیک Rapier + ابزارها + سنسورها + اندازه‌گیری
 * ─────────────────────────────────────────────────────────────
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  GizmoHelper,
  GizmoViewport,
  Grid,
  Html,
  Line,
  OrbitControls,
  Sky,
  TransformControls,
} from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { useSimStore, type ObjectKind, type ToolId } from '@/lib/sim/store';
import { sensorRuntime } from '@/lib/sim/runtime';
import { SimObjectMesh } from './SimObjectMesh';
import { SensorDevice3D } from './SensorDevice3D';

const PLACEMENT_TOOLS: ToolId[] = ['plan', 'wall', 'box', 'sphere', 'cylinder', 'addSensor'];
const GIZMO_MODES: Partial<Record<ToolId, 'translate' | 'rotate' | 'scale'>> = {
  move: 'translate',
  rotate: 'rotate',
  scale: 'scale',
};

/* ── پیش‌برنده‌ی رنتایم دوقلوها + FPS ── */
function EngineDriver() {
  const acc = useRef({ frames: 0, t: 0 });
  useFrame((state, dt) => {
    sensorRuntime.update(state.clock.getElapsedTime() * 1000);
    const a = acc.current;
    a.frames += 1;
    a.t += dt;
    if (a.t >= 0.5) {
      useSimStore.getState().setFps(Math.round(a.frames / a.t));
      a.frames = 0;
      a.t = 0;
    }
  });
  return null;
}

/* ── گیزمو جابجایی/چرخش/مقیاس ── */
function GizmoController() {
  const selectedId = useSimStore((s) => s.selectedId);
  const tool = useSimStore((s) => s.tool);
  const mode = GIZMO_MODES[tool];
  const [registryVersion, setRegistryVersion] = useState(0);

  /* اشتراک در تغییرات رجیستری مش‌ها (الگوی خارجی — بدون setState همگام) */
  useEffect(() => sensorRuntime.onRegistryChange(() => setRegistryVersion((v) => v + 1)), []);

  const obj = useMemo(() => {
    void registryVersion;
    if (!selectedId || !mode) return null;
    return sensorRuntime.getMesh(selectedId) ?? null;
  }, [selectedId, mode, registryVersion]);

  if (!obj || !mode || !selectedId) return null;

  const commit = () => {
    const store = useSimStore.getState();
    const id = selectedId;
    const p = obj.getWorldPosition(new THREE.Vector3());
    const q = obj.getWorldQuaternion(new THREE.Quaternion());
    const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    const s = obj.getWorldScale(new THREE.Vector3());
    if (store.sensors[id]) {
      store.updateSensor(id, {
        position: [p.x, p.y, p.z],
        rotationY: e.y,
      });
    } else if (store.objects[id]) {
      store.updateObject(id, {
        position: [p.x, p.y, p.z],
        rotation: [e.x, e.y, e.z],
        scale: [Math.max(0.02, s.x), Math.max(0.02, s.y), Math.max(0.02, s.z)],
      });
    }
    store.setDragging(null);
  };

  return (
    <TransformControls
      object={obj}
      mode={mode}
      size={0.75}
      onMouseDown={() => useSimStore.getState().setDragging(selectedId)}
      onMouseUp={commit}
    />
  );
}

/* ── صفحه‌ی نامرئی برای قرار دادن اشیاء / اندازه‌گیری ── */
function PlacementPlane() {
  const tool = useSimStore((s) => s.tool);
  const active = PLACEMENT_TOOLS.includes(tool) || tool === 'measure';
  if (!active) return null;
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.001, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        const store = useSimStore.getState();
        const p: [number, number, number] = [e.point.x, 0, e.point.z];
        if (tool === 'measure') {
          store.addMeasurePoint(p);
        } else if (tool === 'addSensor') {
          store.addSensor(p);
          store.setTool('select');
        } else if (PLACEMENT_TOOLS.includes(tool)) {
          const kindMap: Record<string, ObjectKind> = {
            plan: 'floor',
            wall: 'wall',
            box: 'box',
            sphere: 'sphere',
            cylinder: 'cylinder',
          };
          store.addObject(kindMap[tool], p);
          store.setTool('select');
        }
      }}
    >
      <planeGeometry args={[400, 400]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

/* ── لایه‌ی اندازه‌گیری (متر لیزری) ── */
function MeasurementLayer() {
  const measurements = useSimStore((s) => s.measurements);
  const pending = useSimStore((s) => s.pendingMeasurePoint);

  return (
    <group>
      {measurements.map((m) => {
        const mid: [number, number, number] = [
          (m.a[0] + m.b[0]) / 2,
          Math.max(m.a[1], m.b[1]) + 0.12,
          (m.a[2] + m.b[2]) / 2,
        ];
        return (
          <group key={m.id}>
            <Line points={[m.a, m.b]} color="#f59e0b" lineWidth={1.6} />
            <mesh position={m.a}>
              <sphereGeometry args={[0.022, 12, 10]} />
              <meshBasicMaterial color="#fbbf24" />
            </mesh>
            <mesh position={m.b}>
              <sphereGeometry args={[0.022, 12, 10]} />
              <meshBasicMaterial color="#fbbf24" />
            </mesh>
            <Html position={mid} center distanceFactor={9} zIndexRange={[40, 0]}>
              <div
                dir="ltr"
                className="select-none rounded-md border border-amber-500/60 bg-zinc-950/90 px-2 py-0.5 font-mono text-[11px] text-amber-300 shadow"
              >
                {m.distanceM.toFixed(3)} m
              </div>
            </Html>
          </group>
        );
      })}
      {pending && (
        <mesh position={pending}>
          <sphereGeometry args={[0.03, 14, 12]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      )}
    </group>
  );
}

/* ── برچسب‌های خط‌کش گرید (متر) ── */
function RulerLabels() {
  const visible = useSimStore((s) => s.gridVisible);
  if (!visible) return null;
  const ticks = [1, 2, 3, 4, 5];
  return (
    <group>
      {ticks.map((t) => (
        <Html key={`x${t}`} position={[t, 0.02, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
          <span className="select-none font-mono text-[10px] text-zinc-500">{t}m</span>
        </Html>
      ))}
      {ticks.map((t) => (
        <Html key={`z${t}`} position={[0, 0.02, t]} center distanceFactor={14} zIndexRange={[10, 0]}>
          <span className="select-none font-mono text-[10px] text-zinc-500">{t}m</span>
        </Html>
      ))}
    </group>
  );
}

/* ── پوشش HTML روی ویوپورت: خوانش زنده سنسورها ── */
function SensorReadoutOverlay() {
  const sensorOrder = useSimStore((s) => s.sensorOrder);
  const sensors = useSimStore((s) => s.sensors);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 180);
    return () => window.clearInterval(id);
  }, []);
  void tick;
  if (sensorOrder.length === 0) return null;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[240px] flex-col gap-1.5">
      {sensorOrder.map((id) => {
        const s = sensors[id];
        const twin = sensorRuntime.getTwin(id);
        const r = twin?.lastReading;
        return (
          <div
            key={id}
            className="rounded-lg border border-zinc-700/70 bg-zinc-950/80 px-3 py-1.5 font-mono text-[11px] text-zinc-300 shadow-lg backdrop-blur-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-400">{s?.name ?? id}</span>
              <span
                className={
                  r?.outOfRange
                    ? 'text-red-400'
                    : r?.distanceCm != null
                      ? 'text-emerald-300'
                      : 'text-zinc-500'
                }
              >
                {r?.outOfRange
                  ? 'خارج از رنج'
                  : r?.distanceCm != null
                    ? `${r.distanceCm.toFixed(1)} cm`
                    : '---'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── صحنه ── */
function SceneContent() {
  const objects = useSimStore((s) => s.objects);
  const objectOrder = useSimStore((s) => s.objectOrder);
  const sensors = useSimStore((s) => s.sensors);
  const sensorOrder = useSimStore((s) => s.sensorOrder);
  const gridVisible = useSimStore((s) => s.gridVisible);

  return (
    <>
      <Sky sunPosition={[60, 42, -30]} turbidity={5} rayleigh={1.2} />
      <fog attach="fog" args={['#b6c9da', 70, 220]} />
      <hemisphereLight args={['#cfe3f5', '#3a3f47', 0.75]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[14, 20, 9]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />

      {gridVisible && (
        <Grid
          position={[0, 0.002, 0]}
          infiniteGrid
          cellSize={1}
          cellThickness={0.55}
          sectionSize={5}
          sectionThickness={1.15}
          cellColor="#2b3242"
          sectionColor="#4a5876"
          fadeDistance={75}
          fadeStrength={1.3}
        />
      )}
      <RulerLabels />

      <Physics gravity={[0, -9.81, 0]} timeStep={1 / 90}>
        {objectOrder.map((id) => {
          const o = objects[id];
          if (!o) return null;
          const k = `${id}:${o.position.map((n) => n.toFixed(3)).join(',')}|${o.rotation
            .map((n) => n.toFixed(3))
            .join(',')}|${o.scale.map((n) => n.toFixed(3)).join(',')}`;
          return <SimObjectMesh key={id} obj={o} remountKey={k} />;
        })}
        {sensorOrder.map((id) => {
          const s = sensors[id];
          if (!s) return null;
          return <SensorDevice3D key={id} sensor={s} />;
        })}
      </Physics>

      <PlacementPlane />
      <MeasurementLayer />
      <GizmoController />
      <EngineDriver />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={0.4}
        maxDistance={90}
        maxPolarAngle={Math.PI * 0.495}
        target={[0, 0.5, 0]}
      />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="#18181b" />
      </GizmoHelper>
    </>
  );
}

/* ── کامپوننت اصلی ── */
export function ViewportCanvas({ active = true }: { active?: boolean }) {
  /* میان‌برهای صفحه‌کلید */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
        return;
      }
      const store = useSimStore.getState();
      switch (e.key.toLowerCase()) {
        case 'v':
          store.setTool('select');
          break;
        case 'g':
          store.setTool('move');
          break;
        case 'r':
          store.setTool('rotate');
          break;
        case 't':
          store.setTool('scale');
          break;
        case 'm':
          store.setTool('measure');
          break;
        case 'escape':
          useSimStore.setState({ pendingMeasurePoint: null });
          store.select(null);
          break;
        case 'delete':
        case 'backspace':
          if (store.selectedId && store.selectedId !== 'ground') store.removeObject(store.selectedId);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows="percentage"
        frameloop={active ? 'always' : 'never'}
        dpr={[1, 2]}
        camera={{ position: [6.5, 5.5, 9], fov: 50, near: 0.05, far: 400 }}
        gl={{ antialias: true }}
        onPointerMissed={() => useSimStore.getState().select(null)}
      >
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>
      <SensorReadoutOverlay />
    </div>
  );
}
