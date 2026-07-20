"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface HippoSoundRingProps {
  active?: boolean;
  mode?: "idle" | "listening" | "speaking" | "thinking" | "positive" | "encouraging";
  barsCount?: number;
  className?: string;
}

export function HippoSoundRing({
  active = false,
  mode = "idle",
  barsCount = 48,
  className = "",
}: HippoSoundRingProps) {
  const [frequencies, setFrequencies] = useState<number[]>(new Array(barsCount).fill(12));

  useEffect(() => {
    if (!active && mode === "idle") {
      setFrequencies(new Array(barsCount).fill(12));
      return;
    }

    let animId: number;
    let step = 0;

    const animateWave = () => {
      step += 0.08;
      const newFreqs: number[] = [];

      for (let i = 0; i < barsCount; i++) {
        const angle = (i / barsCount) * Math.PI * 2;
        let amplitude = 14;

        if (mode === "listening") {
          amplitude = 18 + Math.sin(angle * 4 + step * 2) * 16 + Math.cos(angle * 2 - step) * 12;
        } else if (mode === "speaking") {
          amplitude = 22 + Math.sin(angle * 6 + step * 3) * 20 + Math.sin(angle * 3 - step * 2) * 15;
        } else if (mode === "thinking") {
          amplitude = 16 + Math.sin(angle * 2 + step) * 8;
        } else if (mode === "positive") {
          // bright, bouncy, celebratory — bigger swings and a faster twinkle
          amplitude = 20 + Math.sin(angle * 8 + step * 5) * 18 + Math.cos(angle * 5 + step * 3) * 10;
        } else if (mode === "encouraging") {
          amplitude = 17 + Math.sin(angle * 3 + step * 1.6) * 10 + Math.cos(angle * 2 - step) * 6;
        } else {
          amplitude = 14 + Math.sin(angle * 3 + step * 4);
        }

        newFreqs.push(Math.max(8, amplitude));
      }

      setFrequencies(newFreqs);
      animId = requestAnimationFrame(animateWave);
    };

    animId = requestAnimationFrame(animateWave);
    return () => cancelAnimationFrame(animId);
  }, [active, mode, barsCount]);

  const getRingColor = () => {
    switch (mode) {
      case "listening":
        return "from-rose-500 via-purple-500 to-indigo-500";
      case "speaking":
        return "from-emerald-400 via-teal-500 to-cyan-500";
      case "thinking":
        return "from-amber-400 via-orange-500 to-purple-500";
      case "positive":
        return "from-amber-300 via-pink-400 to-fuchsia-500";
      case "encouraging":
        return "from-orange-300 via-rose-400 to-purple-400";
      default:
        return "from-purple-400/50 via-indigo-400/40 to-pink-400/50";
    }
  };

  const radius = 170;
  const centerX = 200;
  const centerY = 200;

  return (
    <div className={cn("pointer-events-none relative flex items-center justify-center", className)}>
      {active && (
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.7, 0.3] }}
          transition={{
            duration: mode === "listening" ? 1.2 : mode === "positive" ? 0.8 : 2.0,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className={cn(
            "absolute h-[360px] w-[360px] rounded-full bg-gradient-to-r blur-2xl opacity-40",
            getRingColor()
          )}
        />
      )}

      <svg width="400" height="400" viewBox="0 0 400 400" className="h-full w-full">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="listeningGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="speakingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="positiveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="50%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#c026d3" />
          </linearGradient>
          <linearGradient id="encouragingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>

        {frequencies.map((freq, i) => {
          const angle = (i / barsCount) * Math.PI * 2 - Math.PI / 2;
          const x1 = centerX + Math.cos(angle) * (radius - freq / 2);
          const y1 = centerY + Math.sin(angle) * (radius - freq / 2);
          const x2 = centerX + Math.cos(angle) * (radius + freq / 2);
          const y2 = centerY + Math.sin(angle) * (radius + freq / 2);

          const strokeGradient =
            mode === "listening"
              ? "url(#listeningGrad)"
              : mode === "speaking"
              ? "url(#speakingGrad)"
              : mode === "positive"
              ? "url(#positiveGrad)"
              : mode === "encouraging"
              ? "url(#encouragingGrad)"
              : "url(#ringGrad)";

          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={strokeGradient}
              strokeWidth={mode === "idle" ? "3" : "4"}
              strokeLinecap="round"
              opacity={active ? 0.95 : 0.45}
              style={{ transition: "stroke-width 0.2s" }}
            />
          );
        })}
      </svg>
    </div>
  );
}
