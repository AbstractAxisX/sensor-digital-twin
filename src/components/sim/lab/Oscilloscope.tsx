/**
 * ─────────────────────────────────────────────────────────────
 *  اسیلوسکوپ دیجیتال مجازی — نمایش لبه‌های Trig / Echo
 *  دو لاین LTR: زمان به سمت راست زیاد می‌شود. کانواس خودش LTR است.
 * ─────────────────────────────────────────────────────────────
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EdgeEvent } from '@/sensors';

interface OscilloscopeProps {
  edges: EdgeEvent[];
  stateFa?: string;
}

interface Segment {
  start: number;
  end: number; // ممکن است Infinity باشد (پالس باز)
}

const HEIGHT = 220;
const TRIG_COLOR = '#fbbf24';
const ECHO_COLOR = '#34d399';
const GRID_COLOR = '#27272a';
const TEXT_COLOR = '#52525b';

/** قالب‌بندی زمان: ≥1000µs → میلی‌ثانیه با یک رقم اعشار */
function fmtUs(us: number): string {
  const abs = Math.abs(us);
  if (abs >= 1000) return `${(us / 1000).toFixed(1)}ms`;
  return `${Math.round(us)}µs`;
}

export default function Oscilloscope({ edges, stateFa }: OscilloscopeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = Math.max(1, width);
    const h = HEIGHT;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const pxW = Math.round(w * dpr);
    const pxH = Math.round(h * dpr);
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* پس‌زمینه */
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, w, h);

    /* بازسازی لاین‌های پله‌ای از لبه‌ها (لبه‌ها ترتیب زمانی دارند) */
    const trigSegs: Segment[] = [];
    const echoSegs: Segment[] = [];
    let trigStart: number | null = null;
    let echoStart: number | null = null;
    let lastTrigRise: number | null = null;
    let lastEchoFallT: number | null = null;
    let lastEchoWidth: number | null = null;

    for (const e of edges) {
      if (!Number.isFinite(e.tUs)) continue;
      switch (e.kind) {
        case 'TRIG_RISE':
          lastTrigRise = e.tUs;
          if (trigStart === null) trigStart = e.tUs;
          break;
        case 'TRIG_FALL':
          if (trigStart !== null) {
            trigSegs.push({ start: trigStart, end: e.tUs });
            trigStart = null;
          }
          break;
        case 'ECHO_RISE':
          if (echoStart === null) echoStart = e.tUs;
          break;
        case 'ECHO_FALL':
          if (echoStart !== null) {
            lastEchoWidth = e.tUs - echoStart;
            lastEchoFallT = e.tUs;
            echoSegs.push({ start: echoStart, end: e.tUs });
            echoStart = null;
          }
          break;
      }
    }
    if (trigStart !== null) trigSegs.push({ start: trigStart, end: Number.POSITIVE_INFINITY });
    if (echoStart !== null) echoSegs.push({ start: echoStart, end: Number.POSITIVE_INFINITY });

    /* لاین‌های ثابت (حتی در حالت خالی) */
    const trigBase = 0.78 * h;
    const trigHigh = 0.62 * h;
    const echoBase = 0.28 * h;
    const echoHigh = 0.12 * h;

    ctx.lineWidth = 1;
    ctx.strokeStyle = '#18181b';
    ctx.beginPath();
    ctx.moveTo(0, trigBase);
    ctx.lineTo(w, trigBase);
    ctx.moveTo(0, trigHigh);
    ctx.lineTo(w, trigHigh);
    ctx.moveTo(0, echoBase);
    ctx.lineTo(w, echoBase);
    ctx.moveTo(0, echoHigh);
    ctx.lineTo(w, echoHigh);
    ctx.stroke();

    const anchor = lastEchoFallT ?? lastTrigRise;

    if (anchor !== null && Number.isFinite(anchor)) {
      const winStart = anchor - 1500;
      const winEnd = anchor + 22000;
      const x = (t: number) => ((t - winStart) / (winEnd - winStart)) * w;

      /* گرید عمودی هر ۵ms + برچسب زمان نسبت به لنگر */
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 1;
      ctx.font = '10px monospace';
      ctx.fillStyle = TEXT_COLOR;
      ctx.textAlign = 'left';
      const kStart = Math.ceil((winStart - anchor) / 5000);
      const kEnd = Math.floor((winEnd - anchor) / 5000);
      for (let k = kStart; k <= kEnd; k++) {
        const t = anchor + k * 5000;
        const gx = x(t);
        if (gx < 0 || gx > w) continue;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h - 14);
        ctx.stroke();
        ctx.fillText(fmtUs(t - anchor), gx + 4, h - 3);
      }
      ctx.restore();

      /* رسم یک لاین پله‌ای */
      const drawLane = (
        segs: Segment[],
        baseY: number,
        highY: number,
        color: string,
        lineWidth: number,
        glow: boolean,
      ) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        if (glow) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 8;
        }
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        ctx.lineTo(w, baseY);
        for (const s of segs) {
          const a = Math.max(s.start, winStart);
          const b = Math.min(s.end, winEnd);
          if (!(b > a)) continue;
          const xa = x(a);
          const xb = x(b);
          ctx.moveTo(xa, baseY);
          ctx.lineTo(xa, highY);
          ctx.lineTo(xb, highY);
          ctx.lineTo(xb, baseY);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      };

      drawLane(trigSegs, trigBase, trigHigh, TRIG_COLOR, 1.25, false);
      drawLane(echoSegs, echoBase, echoHigh, ECHO_COLOR, 2, true);

      /* نشانگر لبه‌ی سقوط اکو + عرض پالس */
      if (lastEchoFallT !== null && lastEchoWidth !== null) {
        const xf = x(lastEchoFallT);
        ctx.fillStyle = ECHO_COLOR;
        ctx.beginPath();
        ctx.moveTo(xf, echoBase + 6);
        ctx.lineTo(xf - 4, echoBase + 13);
        ctx.lineTo(xf + 4, echoBase + 13);
        ctx.closePath();
        ctx.fill();
        ctx.font = '10px monospace';
        if (xf < 80) {
          ctx.textAlign = 'left';
          ctx.fillText(`w=${Math.round(lastEchoWidth)}µs`, xf + 7, echoBase + 22);
        } else {
          ctx.textAlign = 'right';
          ctx.fillText(`w=${Math.round(lastEchoWidth)}µs`, xf - 6, echoBase + 22);
        }
      }
    } else {
      /* بدون داده: خطوط پایه‌ی تخت + راهنما */
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, trigBase);
      ctx.lineTo(w, trigBase);
      ctx.moveTo(0, echoBase);
      ctx.lineTo(w, echoBase);
      ctx.stroke();
      ctx.fillStyle = '#52525b';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('پالسی ارسال نشده', w / 2, h / 2);
    }

    /* برچسب کانال‌ها */
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = TRIG_COLOR;
    ctx.fillText('TRIG', 8, trigHigh - 8);
    ctx.fillStyle = ECHO_COLOR;
    ctx.fillText('ECHO', 8, echoHigh - 8);

    /* وضعیت فعلی دوقلو — گوشه‌ی بالا-راست */
    if (stateFa) {
      ctx.fillStyle = '#71717a';
      ctx.textAlign = 'right';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(stateFa, w - 8, 14);
    }
  }, [edges, stateFa, width]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div ref={containerRef} dir="ltr" className="relative w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <canvas ref={canvasRef} className="block w-full" style={{ height: HEIGHT }} />
    </div>
  );
}
