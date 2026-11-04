'use client';

/**
 * ─────────────────────────────────────────────────────────────
 *  ViewportCanvas — قلب موتور WaveLab
 *  رندر Three.js + فیزیک Rapier + ابزارها + سنسورها + اندازه‌گیری
 *
 *  ضدباگ‌های تعامل:
 *  • ابزارهای قرارگیری/متر فقط با «کلیک تمیز» فعال می‌شوند (نه وسط چرخش دوربین)
 *  • فوکوس دوربین واقعی روی شیء/سنسور انتخابی (کلید F یا دکمه)
 *  • نوار کنترل سریع سنسور انتخاب‌شده
 * ─────────────────────────────────────────────────────────────
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
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
import { Crosshair, Zap } from 'lucide-react';
import { useSimStore, type ObjectKind, type ToolId } from '@/lib/sim/store';
import { sensorRuntime } from '@/lib/sim/runtime';
import { SimObjectMesh } from './SimObjectMesh';
import { SensorDevice3D } from './SensorDevice3D';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

const PLACEMENT_TOOLS: ToolId[] = ['plan', 'wall', 'box', 'sphere', 'cylinder', 'addSensor'];
const GIZMO_MODES: Partial<Record<ToolId, 'translate' | 'rotate' | 'scale'>> = {
  move: 'translate',
  rotate: 'rotate',
  scale: 'scale',
};

/* ── ضدهای کلیک در مقابل درگ (چرخش دوربین نباید شیء بگذارد/نقطه بگیرد) ── */
const CLICK_MAX_PX = 6;
const CLICK_MAX_MS = 650;

function pointerDownGuard(e: { clientX: number; clientY: number }) {
  return { x: e.clientX, y: e.clientY, t: performance.now() };
}
function isCleanClick(
  down: { x: number; y: number; t: number } | null,
  e: { clientX: number; clientY: number },
): boolean {
  if (!down) return false;
  const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const dt = performance.now() - down.t;
  return dist <= CLICK_MAX_PX && dt <= CLICK_MAX_MS;
}

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

/* ── کنترلر فوکوس دوربین — درخواست‌های requestFocus را اجرا می‌کند ── */
function CameraController() {
  const focusRequest = useSimStore((s) => s.focusRequest);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null;
  const goal = useRef<{ cam: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  useEffect(() => {
    if (focusRequest === 0) return;
    const id = useSimStore.getState().focusTargetId;
    if (!id) return;
    const mesh = sensorRuntime.getMesh(id);
    if (!mesh) return;
    mesh.updateWorldMatrix(true, false);
    const target = mesh.getWorldPosition(new THREE.Vector3());

    // جهت دید فعلی را حفظ کن، فقط فاصله را جمع کن
    const dir = camera.position.clone().sub(controls?.target ?? target);
    if (dir.lengthSq() < 0.01) dir.set(1.4, 0.9, 1.4);
    dir.normalize();

    const isSensor = !!useSimStore.getState().sensors[id];
    const dist = isSensor ? 1.6 : 3.4;
    const camGoal = target.clone().addScaledVector(dir, dist);
    camGoal.y = Math.max(camGoal.y, 0.35);
    goal.current = { cam: camGoal, target };
  }, [focusRequest, camera, controls]);

  useFrame(() => {
    const g = goal.current;
    if (!g) return;
    camera.position.lerp(g.cam, 0.14);
    if (controls) {
      controls.target.lerp(g.target, 0.14);
      controls.update();
    }
    if (camera.position.distanceTo(g.cam) < 0.04) goal.current = null;
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
  const downRef = useRef<{ x: number; y: number; t: number } | null>(null);
  if (!active) return null;

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    downRef.current = pointerDownGuard(e);
  };

  const handleUp = (e: ThreeEvent<PointerEvent>) => {
    const down = downRef.current;
    downRef.current = null;
    // درگ = چرخش/جابجایی دوربین — نادیده بگیر
    if (!isCleanClick(down, e)) return;

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
  };

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.001, 0]}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
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

/* ── نوار کنترل سریع سنسور انتخاب‌شده ── */
function SensorQuickControls() {
  const selectedId = useSimStore((s) => s.selectedId);
  const isSensor = useSimStore((s) => (selectedId ? !!s.sensors[selectedId] : false));
  const sensor = useSimStore((s) => (selectedId ? s.sensors[selectedId] : undefined));
  const [, force] = useState(0);

  useEffect(() => {
    if (!isSensor) return;
    const id = window.setInterval(() => force((n) => n + 1), 400);
    return () => window.clearInterval(id);
  }, [isSensor, selectedId]);

  if (!isSensor || !sensor || !selectedId) return null;

  return (
    <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-zinc-950/90 px-3 py-2 shadow-2xl backdrop-blur-md">
        <span className="max-w-[120px] truncate text-xs font-bold text-emerald-300">{sensor.name}</span>
        <div className="h-5 w-px bg-zinc-700" />
        <Button
          size="sm"
          className="h-8 gap-1 bg-amber-500 text-xs font-bold text-zinc-950 hover:bg-amber-400"
          onClick={() => sensorRuntime.manualTrigger(selectedId)}
          title="ارسال پالس ۱۰ میکروثانیه‌ای Trig"
        >
          <Zap className="h-3.5 w-3.5" />
          Trig
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 border-zinc-700 bg-zinc-900 text-xs text-zinc-200 hover:bg-zinc-800"
          onClick={() => useSimStore.getState().requestFocus(selectedId)}
          title="نزدیک شدن دوربین به سنسور (F)"
        >
          <Crosshair className="h-3.5 w-3.5" />
          فوکوس
        </Button>
        <div className="flex items-center gap-1.5" title="اندازه‌گیری خودکار">
          <span className="text-[10px] text-zinc-400">خودکار</span>
          <Switch
            checked={sensor.autoRun}
            onCheckedChange={(v) => useSimStore.getState().updateSensor(selectedId, { autoRun: v })}
          />
        </div>
        {sensor.autoRun && (
          <span className="font-mono text-[10px] text-zinc-500">{sensor.cycleMs}ms</span>
        )}
      </div>
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
      <CameraController />
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
        case 'f':
          store.requestFocus();
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
        camera={{ position: [4.2, 2.6, 4.6], fov: 50, near: 0.05, far: 400 }}
        gl={{ antialias: true }}
        onPointerMissed={() => useSimStore.getState().select(null)}
      >
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>
      <SensorReadoutOverlay />
      <SensorQuickControls />
    </div>
  );
}
