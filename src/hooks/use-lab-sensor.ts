/**
 * ─────────────────────────────────────────────────────────────
 *  هوک آزمایشگاه سنسور — دوقلوی مستقل از صحنه‌ی سه‌بعدی
 *  یک هدف سنتتیک (فاصله/متریال/زاویه قابل تنظیم) + اسیلوسکوپ
 * ─────────────────────────────────────────────────────────────
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HCSR04Twin } from '@/sensors/hc-sr04/HCSR04Twin';
import {
  absorptionDbPerM,
  beamPattern,
  echoAmplitude,
  speedOfSound,
} from '@/sensors/core/acoustic';
import type { EdgeEvent, EchoCandidate, SensorEnvironment, TwinReading } from '@/sensors/core/types';

export interface LabTarget {
  /** فاصله‌ی هدف به سانتی‌متر */
  distanceCm: number;
  materialId: string;
  /** زاویه‌ی هدف نسبت به محور سنسور (درجه) */
  angleDeg: number;
}

export interface LabState {
  target: LabTarget;
  env: SensorEnvironment;
  autoRun: boolean;
  cycleMs: number;
}

const EDGE_CAP = 1200;

export function useLabSensor() {
  const [state, setState] = useState<LabState>({
    target: { distanceCm: 60, materialId: 'concrete', angleDeg: 0 },
    env: { temperatureC: 22, humidityPct: 40 },
    autoRun: true,
    cycleMs: 120,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const twinRef = useRef<HCSR04Twin | null>(null);
  const [edges, setEdges] = useState<EdgeEvent[]>([]);
  const [readings, setReadings] = useState<TwinReading[]>([]);
  const [lastReading, setLastReading] = useState<TwinReading | null>(null);
  const [, forceTick] = useState(0);
  const edgeBufferRef = useRef<EdgeEvent[]>([]);
  const dirtyRef = useRef(false);

  if (!twinRef.current) {
    twinRef.current = new HCSR04Twin({
      provideEchos: () => {
        const { target, env } = stateRef.current;
        const d = target.distanceCm / 100;
        const mat = target.materialId;
        // بازتاب از یک صفحه‌ی تخت روبرو با زاویه‌ی انحراف θ
        const matAcoustic = { concrete: 0.92, wood: 0.72, metal: 1.0, glass: 0.96, plastic: 0.8, fabric: 0.22, foam: 0.08, water: 0.95, carpet: 0.35 }[mat] ?? 0.8;
        const cosI = Math.cos((target.angleDeg * Math.PI) / 180);
        const amplitude = echoAmplitude({
          distanceM: d,
          angleDeg: target.angleDeg,
          materialAcoustic: matAcoustic,
          incidenceCos: cosI,
          env,
        });
        const c: EchoCandidate = {
          objectId: 'lab_target',
          materialId: mat,
          distanceM: d,
          angleDeg: target.angleDeg,
          amplitude,
        };
        // در آزمایشگاه، زاویه‌های بزرگ یعنی اکو می‌پرد (بازتاب آینه‌ای واقعی)
        if (target.angleDeg > 35 && Math.random() < 0.85) return [];
        return [c];
      },
      getEnvironment: () => stateRef.current.env,
    });
  }

  const twin = twinRef.current!;

  /* بوفور لبه‌ها + رفرش UI */
  useEffect(() => {
    const off = twin.onReading(() => {
      dirtyRef.current = true;
    });
    return () => {
      off();
    };
  }, [twin]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      setEdges([...edgeBufferRef.current]);
      setReadings([...twin.readings].reverse().slice(0, 60));
      setLastReading(twin.lastReading);
      forceTick((n) => n + 1);
    }, 90);
    return () => window.clearInterval(id);
  }, [twin]);

  /* حلقه‌ی زمان واقعی میکروثانیه‌ای */
  useEffect(() => {
    let raf = 0;
    const captureEdge = (e: EdgeEvent) => {
      edgeBufferRef.current.push(e);
      if (edgeBufferRef.current.length > EDGE_CAP) edgeBufferRef.current.splice(0, edgeBufferRef.current.length - EDGE_CAP);
    };
    twin.edges = edgeBufferRef.current; // بافر مشترک

    let lastAuto = 0;
    const loop = (tMs: number) => {
      const st = stateRef.current;
      if (st.autoRun && tMs - lastAuto >= st.cycleMs) {
        lastAuto = tMs;
        twin.triggerPulse(tMs * 1000);
      }
      twin.update(tMs * 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [twin]);

  /* پاکسازی وقتی تنظیمات عوض می‌شود؟ نه — تایمینگ ادامه دارد */

  const triggerPulse = useCallback(() => {
    twin.triggerPulse(performance.now() * 1000);
  }, [twin]);

  const clearLog = useCallback(() => {
    twin.readings = [];
    setReadings([]);
    setLastReading(null);
    edgeBufferRef.current = [];
    setEdges([]);
  }, [twin]);

  const pauseEdges = useCallback(() => {
    // فریم‌گیری اسکوپ (freeze)
    setEdges([...edgeBufferRef.current]);
  }, []);

  const setTarget = useCallback((patch: Partial<LabTarget>) => {
    setState((s) => ({ ...s, target: { ...s.target, ...patch } }));
  }, []);

  const setEnv = useCallback((patch: Partial<SensorEnvironment>) => {
    setState((s) => ({ ...s, env: { ...s.env, ...patch } }));
  }, []);

  const setAutoRun = useCallback((v: boolean) => {
    setState((s) => ({ ...s, autoRun: v }));
  }, []);

  const setCycleMs = useCallback((v: number) => {
    setState((s) => ({ ...s, cycleMs: v }));
  }, []);

  const speed = speedOfSound(state.env);

  return {
    twin,
    state,
    setTarget,
    setEnv,
    setAutoRun,
    setCycleMs,
    triggerPulse,
    clearLog,
    pauseEdges,
    edges,
    readings,
    lastReading,
    speed,
    /* آمار آزمایشگاه */
    beamGain: beamPattern(state.target.angleDeg),
    absorption: absorptionDbPerM(state.env),
  };
}

export type LabSensor = ReturnType<typeof useLabSensor>;
