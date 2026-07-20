"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface HippoSpeechBubbleProps {
  text: string;
  isTyping?: boolean;
  isSpeaking?: boolean;
  onReplayVoice?: () => void;
  className?: string;
}

export function HippoSpeechBubble({
  text,
  isTyping = false,
  isSpeaking = false,
  onReplayVoice,
  className = "",
}: HippoSpeechBubbleProps) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (isTyping) {
      setDisplayedText("");
      return;
    }

    if (!text) {
      setDisplayedText("");
      return;
    }

    let i = 0;
    setDisplayedText("");

    const speed = text.length > 120 ? 12 : 22;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, isTyping]);

  if (!text && !isTyping) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text || "typing"}
        initial={{ opacity: 0, scale: 0.85, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -10 }}
        transition={{ type: "spring", damping: 20, stiffness: 260 }}
        className={cn(
          "relative max-w-sm rounded-3xl border border-primary/20 bg-card/95 p-4 shadow-xl backdrop-blur-md dark:border-primary/30",
          className
        )}
      >
        <div className="absolute -bottom-2.5 left-1/2 h-5 w-5 -translate-x-1/2 rotate-45 border-r border-b border-primary/20 bg-card/95 dark:border-primary/30" />

        <div className="relative z-10 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-primary">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
              Baby Hippo Partner
            </span>
            {isSpeaking && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold animate-pulse">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Speaking...
              </span>
            )}
          </div>

          {isTyping ? (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <span>Thinking of reply...</span>
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((dot) => (
                  <motion.span
                    key={dot}
                    className="h-2 w-2 rounded-full bg-primary"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: dot * 0.2 }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-foreground font-medium selection:bg-primary/20">
              {displayedText}
              {displayedText.length < text.length && (
                <span className="inline-block h-3.5 w-0.5 ml-0.5 bg-primary animate-pulse" />
              )}
            </p>
          )}

          {!isTyping && onReplayVoice && (
            <div className="mt-1 flex items-center justify-end">
              <button
                onClick={onReplayVoice}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary/80 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
              >
                <Volume2 className="h-3.5 w-3.5" /> Replay Voice
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
