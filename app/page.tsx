"use client";

import { useEffect, useRef, useState } from "react";

const MIN_RATE = 0;
const MAX_RATE = 100;
const WARNING_SECONDS = 5;
const RATE_STORAGE_KEY = "fuelflow:rate";

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
  const [targetInput, setTargetInput] = useState<string>("");
  const [targetAmount, setTargetAmount] = useState<number>(0);

  const lastTickRef = useRef<number | null>(null);
  const flowRateRef = useRef<number>(flowRate);
  const targetAmountRef = useRef<number>(0);
  const alarmFiredRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const hydratedRef = useRef<boolean>(false);

  // Restore last-used flow rate from localStorage on mount.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(RATE_STORAGE_KEY);
      if (saved !== null) {
        const parsed = Number.parseFloat(saved);
        if (!Number.isNaN(parsed)) {
          const clamped = clampRate(parsed);
          setFlowRate(clamped);
          setRateInput(clamped.toString());
        }
      }
    } catch {
      // localStorage unavailable (private mode, disabled, etc.) — ignore.
    }
    hydratedRef.current = true;
  }, []);

  // Persist flow rate after every change (skipping the pre-hydration render).
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(RATE_STORAGE_KEY, flowRate.toString());
    } catch {
      // Ignore quota / disabled storage.
    }
  }, [flowRate]);

  useEffect(() => {
    flowRateRef.current = flowRate;
  }, [flowRate]);

  useEffect(() => {
    targetAmountRef.current = targetAmount;
    alarmFiredRef.current = false;
  }, [targetAmount]);

  const ensureAudio = (): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      audioCtxRef.current = new Ctor();
    }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playAlarm = () => {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const start = now + i * 0.2;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.17);
    }
  };

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
      setTotalDispensed((prev) => {
        const next = prev + flowRateRef.current * elapsedMinutes;
        const target = targetAmountRef.current;
        const rate = flowRateRef.current;
        if (target > 0 && rate > 0 && !alarmFiredRef.current) {
          const secondsToTarget = ((target - next) / rate) * 60;
          if (secondsToTarget > 0 && secondsToTarget <= WARNING_SECONDS) {
            playAlarm();
            alarmFiredRef.current = true;
          }
        }
        return next;
      });
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

  const handleTargetChange = (raw: string) => {
    setTargetInput(raw);
    if (raw === "") {
      setTargetAmount(0);
      return;
    }
    const parsed = Number.parseFloat(raw);
    setTargetAmount(Number.isNaN(parsed) || parsed < 0 ? 0 : parsed);
  };

  const handleStart = () => {
    ensureAudio();
    alarmFiredRef.current = false;
    setIsActive(true);
  };

  const handleReset = () => {
    setTotalDispensed(0);
    alarmFiredRef.current = false;
  };

  const displayRate = flowRate.toFixed(1);
  const displayTotal = totalDispensed.toFixed(2);

  const remainingToTarget =
    targetAmount > 0 ? Math.max(0, targetAmount - totalDispensed) : 0;
  const secondsToTarget =
    targetAmount > 0 && flowRate > 0 && remainingToTarget > 0
      ? (remainingToTarget / flowRate) * 60
      : null;
  const targetReached = targetAmount > 0 && totalDispensed >= targetAmount;
  const inWarningWindow =
    isActive &&
    !targetReached &&
    secondsToTarget !== null &&
    secondsToTarget <= WARNING_SECONDS;

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

          <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest text-neutral-500">
                Total Dispensed
              </div>
              <div className="mt-1 font-mono text-6xl sm:text-7xl font-bold text-neutral-100 tabular-nums">
                {displayTotal}
                <span className="ml-2 text-lg sm:text-xl font-normal text-neutral-400">
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

          <div
            className={`rounded-xl bg-neutral-950 border p-5 transition-colors ${
              inWarningWindow
                ? "border-amber-500 indicator-active"
                : targetReached
                  ? "border-emerald-500"
                  : "border-neutral-800"
            }`}
          >
            <label
              htmlFor="target-input"
              className="flex items-center justify-between text-sm text-neutral-300"
            >
              <span>Target amount</span>
              {targetAmount > 0 && (
                <span
                  className={`text-xs tabular-nums ${
                    targetReached
                      ? "text-emerald-400"
                      : inWarningWindow
                        ? "text-amber-400"
                        : "text-neutral-500"
                  }`}
                >
                  {targetReached
                    ? "Target reached"
                    : secondsToTarget !== null && isActive
                      ? `${remainingToTarget.toFixed(2)} L · ~${Math.ceil(secondsToTarget)}s`
                      : `${remainingToTarget.toFixed(2)} L remaining`}
                </span>
              )}
            </label>
            <div className="mt-2 flex items-stretch gap-3">
              <input
                id="target-input"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                placeholder="Set target..."
                value={targetInput}
                onChange={(e) => handleTargetChange(e.target.value)}
                className="flex-1 min-w-0 rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-3 text-lg font-mono text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/60 transition"
                aria-label="Target amount in litres"
              />
              <span className="self-center text-neutral-500 text-sm">L</span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Alarm sounds {WARNING_SECONDS}s before reaching target.
            </p>
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

          <button
            type="button"
            onClick={isActive ? () => setIsActive(false) : handleStart}
            className={`w-full rounded-xl px-4 py-4 text-base font-semibold text-white shadow-lg transition active:scale-[0.98] hover:opacity-90 ${
              isActive ? "shadow-red-900/30" : "shadow-emerald-900/30"
            }`}
            style={{ backgroundColor: isActive ? "#EF4444" : "#10B981" }}
            aria-pressed={isActive}
          >
            {isActive ? "Stop Flow" : "Start Flow"}
          </button>

          <div className="rounded-xl bg-neutral-950 border border-neutral-800 px-6 py-8 text-center">
            <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-3">
              Current Flow Rate
            </div>
            <div className="flex items-baseline justify-center gap-3 font-mono">
              <span
                className={`text-5xl sm:text-6xl font-bold tabular-nums transition-colors ${
                  isActive ? "text-emerald-400" : "text-neutral-200"
                }`}
              >
                {displayRate}
              </span>
              <span className="text-lg sm:text-xl text-neutral-400">
                L/min
              </span>
            </div>
          </div>
        </section>

        <footer className="mt-6 text-center text-xs text-neutral-600">
          Fuel Flow Meter · v1.1
        </footer>
      </div>
    </main>
  );
}
