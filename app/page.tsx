"use client";

import { useEffect, useRef, useState } from "react";

const MIN_RATE = 0;
const MAX_RATE = 100;

function clampRate(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < MIN_RATE) return MIN_RATE;
  if (value > MAX_RATE) return MAX_RATE;
  return value;
}

export default function Home() {
  const [flowRate, setFlowRate] = useState<number>(12.5);
  const [rateInput, setRateInput] = useState<string>("12.5");
  const [isActive, setIsActive] = useState<boolean>(false);
  const [totalDispensed, setTotalDispensed] = useState<number>(0);

  const lastTickRef = useRef<number | null>(null);
  const flowRateRef = useRef<number>(flowRate);

  useEffect(() => {
    flowRateRef.current = flowRate;
  }, [flowRate]);

  useEffect(() => {
    if (!isActive) {
      lastTickRef.current = null;
      return;
    }

    lastTickRef.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const last = lastTickRef.current ?? now;
      const elapsedMinutes = (now - last) / 1000 / 60;
      lastTickRef.current = now;
      setTotalDispensed((prev) => prev + flowRateRef.current * elapsedMinutes);
    }, 100);

    return () => {
      window.clearInterval(id);
      lastTickRef.current = null;
    };
  }, [isActive]);

  const handleRateChange = (raw: string) => {
    setRateInput(raw);
    if (raw === "" || raw === "-") {
      setFlowRate(0);
      return;
    }
    const parsed = Number.parseFloat(raw);
    setFlowRate(clampRate(parsed));
  };

  const handleRateBlur = () => {
    const clamped = clampRate(Number.parseFloat(rateInput));
    setFlowRate(clamped);
    setRateInput(clamped.toString());
  };

  const handleSliderChange = (raw: string) => {
    const value = clampRate(Number.parseFloat(raw));
    setFlowRate(value);
    setRateInput(value.toString());
  };

  const handleReset = () => {
    setTotalDispensed(0);
  };

  const displayRate = flowRate.toFixed(1);
  const displayTotal = totalDispensed.toFixed(2);

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-100">
            Fuel Flow Meter
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Real-time fuel flow measurement
          </p>
        </header>

        <section className="rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-2xl shadow-black/40 backdrop-blur p-6 sm:p-8 space-y-8">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-neutral-500">
              Status
            </span>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className={`h-3 w-3 rounded-full ${
                  isActive
                    ? "bg-emerald-500 indicator-active"
                    : "bg-neutral-600"
                }`}
              />
              <span
                className={`text-sm font-semibold tracking-wide ${
                  isActive ? "text-emerald-400" : "text-neutral-400"
                }`}
              >
                {isActive ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-neutral-950 border border-neutral-800 px-6 py-8 text-center">
            <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-3">
              Current Flow Rate
            </div>
            <div className="flex items-baseline justify-center gap-3 font-mono">
              <span
                className={`text-6xl sm:text-7xl font-bold tabular-nums transition-colors ${
                  isActive ? "text-emerald-400" : "text-neutral-200"
                }`}
              >
                {displayRate}
              </span>
              <span className="text-xl sm:text-2xl text-neutral-400">
                L/min
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <label
              htmlFor="rate-input"
              className="flex items-center justify-between text-sm text-neutral-300"
            >
              <span>Flow rate</span>
              <span className="text-xs text-neutral-500">
                {MIN_RATE} – {MAX_RATE} L/min
              </span>
            </label>

            <div className="flex items-stretch gap-3">
              <input
                id="rate-input"
                type="number"
                inputMode="decimal"
                min={MIN_RATE}
                max={MAX_RATE}
                step="0.1"
                value={rateInput}
                onChange={(e) => handleRateChange(e.target.value)}
                onBlur={handleRateBlur}
                className="flex-1 min-w-0 rounded-lg bg-neutral-950 border border-neutral-800 px-4 py-3 text-lg font-mono text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/60 transition"
                aria-label="Flow rate in litres per minute"
              />
              <span className="self-center text-neutral-500 text-sm">L/min</span>
            </div>

            <input
              type="range"
              min={MIN_RATE}
              max={MAX_RATE}
              step="0.1"
              value={flowRate}
              onChange={(e) => handleSliderChange(e.target.value)}
              className="w-full accent-emerald-500"
              aria-label="Flow rate slider"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsActive(true)}
              disabled={isActive}
              className="rounded-xl px-4 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-900/30 transition active:scale-[0.97] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              style={{ backgroundColor: "#10B981" }}
            >
              Start Flow
            </button>
            <button
              type="button"
              onClick={() => setIsActive(false)}
              disabled={!isActive}
              className="rounded-xl px-4 py-4 text-base font-semibold text-white shadow-lg shadow-red-900/30 transition active:scale-[0.97] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              style={{ backgroundColor: "#EF4444" }}
            >
              Stop Flow
            </button>
          </div>

          <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest text-neutral-500">
                Total Dispensed
              </div>
              <div className="mt-1 font-mono text-2xl sm:text-3xl font-bold text-neutral-100 tabular-nums">
                {displayTotal}
                <span className="ml-2 text-sm font-normal text-neutral-400">
                  L
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="shrink-0 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800 active:scale-[0.97] transition"
            >
              Reset
            </button>
          </div>
        </section>

        <footer className="mt-6 text-center text-xs text-neutral-600">
          Fuel Flow Meter · v1.0
        </footer>
      </div>
    </main>
  );
}
