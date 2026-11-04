/**
 * ─────────────────────────────────────────────────────────────
 *  WaveLab Engine — استور مرکزی موتور (Zustand)
 *  صحنه، اشیاء، سنسورها، ابزارها، محیط، اندازه‌گیری‌ها
 * ─────────────────────────────────────────────────────────────
 */

import { create } from 'zustand';
import type { SensorEnvironment } from '@/sensors/core/types';

/* ── انواع صحنه ──────────────────────────────────────────── */

export type ObjectKind = 'floor' | 'box' | 'sphere' | 'cylinder' | 'wall';
export type ToolId =
  | 'select'
  | 'move'
  | 'rotate'
  | 'scale'
  | 'measure'
  | 'plan'
  | 'wall'
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'addSensor';

export interface SimObject {
  id: string;
  kind: ObjectKind;
  name: string;
  materialId: string;
  /** متر */
  position: [number, number, number];
  /** رادیان (پیش‌فرض حول Y) */
  rotation: [number, number, number];
  /** مقیاس = ابعاد نهایی به متر */
  scale: [number, number, number];
  /** فیزیک: ثابت (فرورفته در زمین) یا دینامیک ( تحت جاذبه) */
  dynamic: boolean;
}

export interface SensorInstance {
  id: string;
  kind: 'HC-SR04';
  name: string;
  position: [number, number, number];
  rotationY: number;
  autoRun: boolean;
  cycleMs: number;
}

export interface Measurement {
  id: string;
  a: [number, number, number];
  b: [number, number, number];
  distanceM: number;
}

export interface SceneSnapshot {
  objects: SimObject[];
  sensors: SensorInstance[];
  env: SensorEnvironment;
  measurements: Measurement[];
}

/* ── وضعیت ───────────────────────────────────────────────── */

interface SimState {
  objects: Record<string, SimObject>;
  objectOrder: string[];
  sensors: Record<string, SensorInstance>;
  sensorOrder: string[];

  selectedId: string | null;
  /** شناسه‌ی شیء در حال جابجایی با گیزمو (برای فریز فیزیک) */
  draggingId: string | null;
  tool: ToolId;

  /** شمارنده‌ی درخواست فوکوس دوربین + هدف */
  focusRequest: number;
  focusTargetId: string | null;

  /** اکوهای کاذب نویزی (رفتار واقعی) — پیش‌فرض خاموش */
  phantomEchoes: boolean;

  env: SensorEnvironment;
  gridVisible: boolean;

  measurements: Measurement[];
  pendingMeasurePoint: [number, number, number] | null;

  /** ابعاد پلن/شیء قبل از قرار دادن (متر) */
  planWidth: number;
  planDepth: number;
  wallWidth: number;
  wallHeight: number;

  fps: number;

  /* ── اکشن‌ها ── */
  addObject: (kind: ObjectKind, pos: [number, number, number], opts?: Partial<SimObject>) => string;
  addSensor: (pos: [number, number, number]) => string;
  updateObject: (id: string, patch: Partial<SimObject>) => void;
  updateSensor: (id: string, patch: Partial<SensorInstance>) => void;
  removeObject: (id: string) => void;
  removeSensor: (id: string) => void;
  select: (id: string | null) => void;
  setTool: (t: ToolId) => void;
  setDragging: (id: string | null) => void;
  /** فوکوس دوربین روی شیء/سنسور (پیش‌فرض: انتخاب فعلی) */
  requestFocus: (id?: string) => void;
  setPhantomEchoes: (v: boolean) => void;
  setEnv: (patch: Partial<SensorEnvironment>) => void;
  toggleGrid: () => void;
  setPlanSize: (w: number, d: number) => void;
  setWallSize: (w: number, h: number) => void;
  addMeasurePoint: (p: [number, number, number]) => void;
  clearMeasurements: () => void;
  setFps: (fps: number) => void;
  getSnapshot: () => SceneSnapshot;
  loadSnapshot: (s: SceneSnapshot) => void;
  resetScene: () => void;
}

let uid = 0;
function nextId(prefix: string): string {
  uid += 1;
  return `${prefix}_${Date.now().toString(36)}${uid}`;
}

const NAMES_FA: Record<ObjectKind, string> = {
  floor: 'پلن',
  box: 'جعبه',
  sphere: 'گوی',
  cylinder: 'استوانه',
  wall: 'دیوار',
};

export const DEFAULT_ENV: SensorEnvironment = {
  temperatureC: 22,
  humidityPct: 40,
};

function defaultScene(): { objects: Record<string, SimObject>; objectOrder: string[]; sensors: Record<string, SensorInstance>; sensorOrder: string[] } {
  // صحنه‌ی شروع: زمین پایه + یک دیوار بتنی + یک جعبه‌ی دینامیک + سنسور
  const ground: SimObject = {
    id: 'ground',
    kind: 'floor',
    name: 'زمین پایه',
    materialId: 'concrete',
    position: [0, -0.05, 0],
    rotation: [0, 0, 0],
    scale: [40, 0.1, 40],
    dynamic: false,
  };
  const wall: SimObject = {
    id: 'demo_wall',
    kind: 'wall',
    name: 'دیوار بتنی',
    materialId: 'concrete',
    position: [0, 1.25, -2],
    rotation: [0, 0, 0],
    scale: [4, 2.5, 0.15],
    dynamic: false,
  };
  const crate: SimObject = {
    id: 'demo_crate',
    kind: 'box',
    name: 'جعبه‌ی چوبی',
    materialId: 'wood',
    position: [0.3, 0.25, -0.6],
    rotation: [0, 0.35, 0],
    scale: [0.5, 0.5, 0.5],
    dynamic: true,
  };
  const sensor: SensorInstance = {
    id: 'demo_sensor',
    kind: 'HC-SR04',
    name: 'HC-SR04 #۱',
    position: [0, 0.25, 1],
    rotationY: Math.PI, // رو به دیوار (−Z)
    autoRun: true,
    cycleMs: 80,
  };
  return {
    objects: { ground, demo_wall: wall, demo_crate: crate },
    objectOrder: ['ground', 'demo_wall', 'demo_crate'],
    sensors: { demo_sensor: sensor },
    sensorOrder: ['demo_sensor'],
  };
}

export const useSimStore = create<SimState>((set, get) => ({
  ...defaultScene(),

  selectedId: null,
  draggingId: null,
  tool: 'select',
  focusRequest: 0,
  focusTargetId: null,
  phantomEchoes: false,
  env: { ...DEFAULT_ENV },
  gridVisible: true,
  measurements: [],
  pendingMeasurePoint: null,
  planWidth: 4,
  planDepth: 4,
  wallWidth: 3,
  wallHeight: 2.6,
  fps: 60,

  addObject: (kind, pos, opts) => {
    const id = nextId(kind);
    const sizes: Record<ObjectKind, [number, number, number]> = {
      floor: [get().planWidth, 0.05, get().planDepth],
      box: [0.5, 0.5, 0.5],
      sphere: [0.35, 0.35, 0.35],
      cylinder: [0.3, 0.7, 0.3],
      wall: [get().wallWidth, get().wallHeight, 0.12],
    };
    const y =
      kind === 'floor' ? 0.026 : kind === 'wall' ? get().wallHeight / 2 : sizes[kind][1] / 2 + 0.01;
    const obj: SimObject = {
      id,
      kind,
      name: `${NAMES_FA[kind]} ${get().objectOrder.filter((o) => get().objects[o].kind === kind).length + 1}`,
      materialId: kind === 'floor' ? 'concrete' : kind === 'wall' ? 'concrete' : 'wood',
      position: [pos[0], y, pos[2]],
      rotation: [0, 0, 0],
      scale: sizes[kind],
      dynamic: kind === 'box' || kind === 'sphere' || kind === 'cylinder',
      ...opts,
    };
    set((st) => ({
      objects: { ...st.objects, [id]: obj },
      objectOrder: [...st.objectOrder, id],
      selectedId: id,
    }));
    return id;
  },

  addSensor: (pos) => {
    const id = nextId('hcsr04');
    const n = get().sensorOrder.length + 1;
    const sensor: SensorInstance = {
      id,
      kind: 'HC-SR04',
      name: `HC-SR04 #${n}`,
      position: [pos[0], 0.25, pos[2]],
      rotationY: 0,
      autoRun: true,
      cycleMs: 80,
    };
    set((st) => ({
      sensors: { ...st.sensors, [id]: sensor },
      sensorOrder: [...st.sensorOrder, id],
      selectedId: id,
    }));
    return id;
  },

  updateObject: (id, patch) =>
    set((st) => {
      const obj = st.objects[id];
      if (!obj) return st;
      return { objects: { ...st.objects, [id]: { ...obj, ...patch } } };
    }),

  updateSensor: (id, patch) =>
    set((st) => {
      const s = st.sensors[id];
      if (!s) return st;
      return { sensors: { ...st.sensors, [id]: { ...s, ...patch } } };
    }),

  removeObject: (id) =>
    set((st) => {
      if (id === 'ground') return st;
      const objects = { ...st.objects };
      delete objects[id];
      const sensors = { ...st.sensors };
      delete sensors[id];
      return {
        objects,
        objectOrder: st.objectOrder.filter((o) => o !== id),
        sensors,
        sensorOrder: st.sensorOrder.filter((o) => o !== id),
        selectedId: st.selectedId === id ? null : st.selectedId,
      };
    }),

  removeSensor: (id) =>
    set((st) => {
      const sensors = { ...st.sensors };
      delete sensors[id];
      return {
        sensors,
        sensorOrder: st.sensorOrder.filter((o) => o !== id),
        selectedId: st.selectedId === id ? null : st.selectedId,
      };
    }),

  select: (id) => set({ selectedId: id }),
  setTool: (t) => set({ tool: t, pendingMeasurePoint: null }),
  setDragging: (id) => set({ draggingId: id }),
  requestFocus: (id) =>
    set((st) => ({
      focusTargetId: id ?? st.selectedId,
      focusRequest: st.focusRequest + 1,
    })),
  setPhantomEchoes: (v) => set({ phantomEchoes: v }),
  setEnv: (patch) => set((st) => ({ env: { ...st.env, ...patch } })),
  toggleGrid: () => set((st) => ({ gridVisible: !st.gridVisible })),
  setPlanSize: (w, d) => set({ planWidth: w, planDepth: d }),
  setWallSize: (w, h) => set({ wallWidth: w, wallHeight: h }),

  addMeasurePoint: (p) =>
    set((st) => {
      if (!st.pendingMeasurePoint) return { pendingMeasurePoint: p };
      const a = st.pendingMeasurePoint;
      const dm = Math.hypot(a[0] - p[0], a[1] - p[1], a[2] - p[2]);
      const m: Measurement = { id: nextId('msr'), a, b: p, distanceM: dm };
      return { measurements: [...st.measurements, m], pendingMeasurePoint: null };
    }),

  clearMeasurements: () => set({ measurements: [], pendingMeasurePoint: null }),

  setFps: (fps) => set({ fps }),

  getSnapshot: () => {
    const st = get();
    return {
      objects: st.objectOrder.map((id) => st.objects[id]).filter((o) => o && o.id !== 'ground'),
      sensors: st.sensorOrder.map((id) => st.sensors[id]),
      env: st.env,
      measurements: st.measurements,
    };
  },

  loadSnapshot: (s) => {
    const objects: Record<string, SimObject> = {
      ground: {
        id: 'ground',
        kind: 'floor',
        name: 'زمین پایه',
        materialId: 'concrete',
        position: [0, -0.05, 0],
        rotation: [0, 0, 0],
        scale: [40, 0.1, 40],
        dynamic: false,
      },
    };
    const objectOrder = ['ground'];
    for (const o of s.objects) {
      objects[o.id] = o;
      objectOrder.push(o.id);
    }
    const sensors: Record<string, SensorInstance> = {};
    const sensorOrder: string[] = [];
    for (const sn of s.sensors) {
      sensors[sn.id] = sn;
      sensorOrder.push(sn.id);
    }
    set({
      objects,
      objectOrder,
      sensors,
      sensorOrder,
      env: s.env,
      measurements: s.measurements ?? [],
      pendingMeasurePoint: null,
      selectedId: null,
    });
  },

  resetScene: () => {
    set({ ...defaultScene(), selectedId: null, measurements: [], pendingMeasurePoint: null, env: { ...DEFAULT_ENV } });
  },
}));
