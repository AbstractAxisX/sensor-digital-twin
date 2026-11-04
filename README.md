# 🔬 Sensor Digital Twin Lab

> Real-time, physics-accurate **digital twin** of embedded sensors — starting with the legendary **HC-SR04 ultrasonic rangefinder**.

<p align="center">
  <em>3D interactive lab · microsecond-timing state machine · acoustic propagation physics · oscilloscope · virtual MCU</em>
</p>

---

## 📖 About

Sensor Digital Twin Lab is a simulation platform that reproduces the **complete behavior** of real sensors inside the browser — not an idealized textbook model, but a twin faithful to the *real* device, quirks included.

The first module is the **HC-SR04**, modeled down to the microsecond, based on the official datasheets (SparkFun / HandsonTec) and reverse-engineered internal circuitry (EM78P153S MCU + MAX232 charge pump + LM324 receive chain).

### What makes it "twin", not "toy"?

| Real device behavior | Simulated |
|---|---|
| 8-pulse 40 kHz burst (200 µs) after ~258 µs startup delay | ✅ |
| 38 ms echo timeout (out-of-range = 400 cm reading) | ✅ |
| 2 cm blind zone (ring-down of the transducer) | ✅ |
| 60 ms minimum measurement cycle | ✅ |
| `+25 µs` staircase error (MCU polling misses first pulse) | ✅ |
| Amplitude-only detection → random false echoes on no target | ✅ |
| Speed of sound `v = 331.3 + 0.606·T` + humidity correction | ✅ |
| Atmospheric attenuation (~1.2 dB/m @ 40 kHz) + inverse-square spread | ✅ |
| Material interaction (fabric absorbs, specular surfaces deflect > 22°) | ✅ |
| Multi-sensor crosstalk (needs ≥ 33 ms spacing) | ✅ |

## ✨ Features

- 🎛️ **Interactive 3D lab** — place sensors, planes & objects, measure distances (Three.js)
- 🧪 **Dedicated sensor test page** — bench-test the HC-SR04 in isolation
- 📡 **Live oscilloscope** — real-time Trig/Echo waveforms with µs-precision cursors
- 🖥️ **Virtual MCU** — emulates `pulseIn()`-style reading of the Echo line
- 🌡️ **Environment controls** — temperature & humidity affect acoustic physics live
- 💾 **Scene persistence** — save/load lab layouts via REST API + Prisma/SQLite
- 🧩 **Modular sensor registry** — new sensors plug into `src/sensors/<model>/`

## 🏗️ Architecture

```
src/
├── sensors/                  # 🔌 Sensor modules (the digital twins)
│   ├── core/                 #    Shared physics: acoustic, materials, types
│   ├── hc-sr04/              #    HC-SR04: specs, timing state machine (HCSR04Twin)
│   └── index.ts              #    Sensor registry
├── lib/sim/
│   ├── runtime.ts            #    Simulation runtime loop
│   └── store.ts              #    Zustand state
├── components/sim/
│   ├── viewport/             #    3D scene (canvas, sensor device, meshes)
│   ├── lab/                  #    Sensor test bench (oscilloscope, controls)
│   └── shell/                #    TopBar, toolbar, inspector, status bar
└── app/api/scenes/           #    Scene CRUD (REST + Prisma)
```

## 🚀 Getting Started

```bash
# 1) create your local .env from the example (safe, no secrets inside)
cp .env.example .env        # Windows PowerShell:  copy .env.example .env

# 2) install dependencies
bun install

# 3) push the database schema
bun run db:push

# 4) start the dev server
bun run dev          # Windows:  bun run dev:win
```

> ℹ️ `DATABASE_URL` uses a **relative path** (`file:../db/custom.db`), so it works unchanged on Windows, macOS and Linux. The `db/*.db` files are git-ignored — your local data stays local.

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript 5 |
| 3D | Three.js (react-three-fiber) |
| UI | Tailwind CSS 4 + shadcn/ui |
| State | Zustand |
| Database | Prisma + SQLite |

## 🗺️ Roadmap

- [ ] More sensors on the same engine (DHT22, PIR, IR, LDR…)
- [ ] Multi-sensor crosstalk scenarios in the 3D room
- [ ] Export timing traces (CSV / Saleae-style captures)
- [ ] Firmware-in-the-loop mode

---

<p align="center">Built with 🔊 and ⚡ by <a href="https://github.com/AbstractAxisX">@AbstractAxisX</a></p>
