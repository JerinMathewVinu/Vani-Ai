"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Sparkles,
  AlertTriangle,
  Award,
  BarChart2,
  CheckCircle2,
  Flame,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SectionHeader } from "@/components/dashboard/section-header";
import { BabyHippo3D, type HippoState } from "@/components/baby-hippo-3d";
import { HippoSpeechBubble } from "@/components/hippo-speech-bubble";
import { HippoSoundRing } from "@/components/hippo-sound-ring";
import { useApi } from "@/hooks/use-api";
import { partnerApi, type PartnerSessionSummary } from "@/api/partner";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import type { ChatMessage } from "@/lib/types";

// Default topic pills fallback when server is offline
const defaultTopics = [
  { id: "travel", emoji: "✈️", label: "Travel & Vacation" },
  { id: "interview", emoji: "💼", label: "Job Interview" },
  { id: "tech", emoji: "🤖", label: "Tech & AI Trends" },
  { id: "hobbies", emoji: "🍿", label: "Movies & Hobbies" },
  { id: "food", emoji: "🍕", label: "Food & Cooking" },
  { id: "chat", emoji: "☕", label: "Daily Casual Chat" },
];

const HINDI_WORD_REGEX =
  /\b(kaise|kya|haan|naam|aap|hai|hain|hu|hoon|bhai|karo|kaha|kahani|phir|accha|acha|achha|namaste|shukriya|mujhe|mera|meri|mere|tum|tumhara|tumhari|kaisa|kaisi|main|bol|bolo|raha|rahi|rahe|samajh|samjhe|nhi|nahi|matlab|kuch|chahiye|pata|chalo|yaha|waha|sab|kaun|kab|kyun|batao|bataiye|baat|dost|hoga|hogi|hogaye|suno|thoda|thodi|wala|wali|wale|lekin|magar|par|kar|diya|liya|dega|karna|karke|rakho|aaj|kal|parso|ab|abhi|sath|saath|pass|paas|kaam|ghar|log|duniya|bilkul|sahi|galat|bohot|bahut|kam|zyaada|jyada)\b/gi;
const DEVANAGARI_REGEX = /[\u0900-\u097F]+/;

function detectHindiWords(text: string): string[] {
  const matches: string[] = Array.from(text.match(HINDI_WORD_REGEX) || []);
  if (DEVANAGARI_REGEX.test(text)) {
    matches.push("Hindi Devanagari Script");
  }
  return Array.from(new Set(matches.map((m) => m.toLowerCase())));
}

export default function PartnerPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [languageAlertWords, setLanguageAlertWords] = useState<string[]>([]);
  const [difficultyLevel, setDifficultyLevel] = useState<"easy" | "medium" | "hard">("easy");
  const [difficultyLabel, setDifficultyLabel] = useState<string>("🌱 Easy (Warm-up)");
  const [turnCount, setTurnCount] = useState<number>(0);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [positiveSparkle, setPositiveSparkle] = useState<boolean>(false);

  // Summary modal state
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<PartnerSessionSummary | null>(null);
  const [endingSession, setEndingSession] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const { data: topicsData } = useApi(["partner-topics"], partnerApi.getTopics);
  const { data: history } = useApi(["partner-history"], () => partnerApi.getHistory());

  const activeTopics = topicsData && topicsData.length > 0 ? topicsData : defaultTopics;

  // Load history
  useEffect(() => {
    if (history) setMessages(history);
  }, [history]);

  // Scroll to bottom of transcript
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, isSpeaking]);

  // Load SpeechSynthesis voices for Child-Friendly AI Voice Agent
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      const englishVoices = available.filter((v) => v.lang.startsWith("en"));
      setVoices(englishVoices.length ? englishVoices : available);
      if (englishVoices.length && !selectedVoice) {
        const pref =
          englishVoices.find(
            (v) =>
              v.name.includes("Samantha") ||
              v.name.includes("Google") ||
              v.name.includes("Natural") ||
              v.name.includes("Zira") ||
              v.name.includes("Victoria")
          ) || englishVoices[0];
        setSelectedVoice(pref.name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [selectedVoice]);

  // Speech Recognition (STT) setup
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recog = new SpeechRecognition();
    recog.continuous = false;
    recog.interimResults = true;
    recog.lang = "en-US";

    recog.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join("");
      setInput(transcript);

      if (event.results[0].isFinal) {
        setIsListening(false);
        send(transcript);
      }
    };

    recog.onerror = (err: any) => {
      console.warn("Speech recognition error:", err);
      setIsListening(false);
    };

    recog.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recog;
  }, []);

  // Child-friendly Speech Synthesis (TTS) - pitch 1.25 for soft friendly baby hippo mascot tone
  const speakReply = (text: string) => {
    if (muted || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/💡[\s\S]*$/, "").trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (selectedVoice) {
      const vObj = voices.find((v) => v.name === selectedVoice);
      if (vObj) utterance.voice = vObj;
    }
    utterance.rate = 0.95;
    utterance.pitch = 1.25;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setInput("");
      try {
        recognitionRef.current?.start();
        setIsListening(true);
        toast("Baby Hippo is listening! Speak now...", { icon: "🎤" });
      } catch (err) {
        toast.error("Microphone access failed. You can type your response below!");
      }
    }
  };

  const send = async (text: string) => {
    const value = text.trim();
    if (!value) return;

    // Check Hindi words immediately
    const clientHindiWords = detectHindiWords(value);

    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: value,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const res = await partnerApi.sendMessage({ message: value });
      setTyping(false);
      setMessages((m) => [...m, res]);

      if (res.difficultyLevel && res.difficultyLevel !== difficultyLevel) {
        const icon = res.difficultyLevel === "medium" ? "🚀" : "🔥";
        toast(`Level Up! ${res.difficultyLabel}`, { icon, duration: 4000 });
        setPositiveSparkle(true);
        setTimeout(() => setPositiveSparkle(false), 3500);
      }
      if (res.difficultyLevel) setDifficultyLevel(res.difficultyLevel);
      if (res.difficultyLabel) setDifficultyLabel(res.difficultyLabel);
      if (res.turnCount) setTurnCount(res.turnCount);

      if (res.languageAlert || clientHindiWords.length > 0) {
        const allHindi = Array.from(new Set([...(res.detectedNonEnglishWords || []), ...clientHindiWords]));
        setLanguageAlertWords(allHindi.length > 0 ? allHindi : ["Hindi"]);
      } else {
        setLanguageAlertWords([]);
        setPositiveSparkle(true);
        setTimeout(() => setPositiveSparkle(false), 3000);
      }

      speakReply(res.content);
    } catch (err) {
      setTyping(false);
      let fallbackReply = `That's great! You mentioned: "${value}". Could you elaborate more on that in English? 🦛✨`;
      if (clientHindiWords.length > 0) {
        setLanguageAlertWords(clientHindiWords);
        fallbackReply = `I noticed some Hindi words like (${clientHindiWords.join(", ")}). In English, you can say: "My name is..." or "I want to...". Let's try that sentence in English! 🦛💡`;
      }
      const aiMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: fallbackReply,
        createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m, aiMsg]);
      speakReply(fallbackReply);
    }
  };

  const handleEndSession = async () => {
    setEndingSession(true);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    try {
      const summary = await partnerApi.stopSession();
      setSummaryData(summary);
      setSummaryOpen(true);
    } catch (err) {
      // Offline fallback summary
      setSummaryData({
        id: "local-summary",
        score: 92,
        fluencyScore: 88,
        fillerCount: 1,
        fillerBreakdown: { um: 1 },
        languageAlertsCount: 0,
        grammarErrors: [{ original: "I goes to market", tip: "Say: 'I go to the market'" }],
        durationSeconds: 120,
        totalWords: 150,
        coachingTips: [
          "Great natural flow! Keep expanding your sentence length.",
          "Good pronunciation and steady speech rhythm.",
        ],
      });
      setSummaryOpen(true);
    } finally {
      setEndingSession(false);
    }
  };

  const handleStartNewSession = async () => {
    setSummaryOpen(false);
    try {
      const res = await partnerApi.resetSession();
      setMessages([
        {
          id: "greeting",
          role: "assistant",
          content: res.greeting,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setMessages([
        {
          id: "greeting",
          role: "assistant",
          content: "Hello there! I'm your Vaani Voice Partner. Tap the mic to practice English with me!",
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setDifficultyLevel("easy");
    setDifficultyLabel("🌱 Easy (Warm-up)");
    setTurnCount(0);
    setLanguageAlertWords([]);
    toast.success("New practice session started!");
  };

  // Determine current 3D Hippo Animation State
  const getHippoState = (): HippoState => {
    if (isListening) return "listening";
    if (typing) return "thinking";
    if (isSpeaking) return "speaking";
    if (languageAlertWords.length > 0) return "encouraging";
    if (positiveSparkle) return "positive";
    return "idle";
  };

  const latestAssistantMessage =
    messages.filter((m) => m.role === "assistant").pop()?.content ||
    "Hello there! I'm your Vaani Voice Partner. Tap the mic to practice English with me!";

  return (
    <div className="flex h-full min-h-[calc(100vh-5rem)] flex-col gap-3 p-1">
      {/* 1. TOP HEADER */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <SectionHeader
          title="Vaani Voice Partner"
          subtitle="Interactive 3D Baby Hippo companion for English speaking practice."
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* Difficulty Badge */}
          <Badge
            variant={
              difficultyLevel === "easy"
                ? "success"
                : difficultyLevel === "medium"
                ? "secondary"
                : "destructive"
            }
            className="px-3 py-1 text-xs font-semibold shadow-sm"
          >
            {difficultyLabel}
          </Badge>

          {/* Voice Select */}
          {voices.length > 0 && (
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="h-8.5 rounded-xl border border-border bg-card px-2.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary shadow-sm"
            >
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name.replace(/Google|Microsoft/g, "")} ({v.lang})
                </option>
              ))}
            </select>
          )}

          {/* Mute Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMuted(!muted);
              if (!muted && typeof window !== "undefined") window.speechSynthesis.cancel();
            }}
            className="h-8.5 shadow-sm text-xs"
          >
            {muted ? (
              <VolumeX className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-primary" />
            )}
            {muted ? "Muted" : "Voice On"}
          </Button>

          {/* End Session Button */}
          <Button
            variant="gradient"
            size="sm"
            onClick={handleEndSession}
            loading={endingSession}
            className="h-8.5 shadow-md text-xs"
          >
            <BarChart2 className="h-3.5 w-3.5" /> End Session & Feedback
          </Button>
        </div>
      </div>

      {/* TOPIC SELECTION BAR */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0">
        <span className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Practice Topics:
        </span>
        {activeTopics.map((t) => (
          <button
            key={t.id}
            onClick={() => send(`Let's talk about ${t.label.toLowerCase()}`)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium transition-all hover:bg-primary/10 hover:border-primary/40 active:scale-95 shadow-sm"
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* LANGUAGE WARNING / ENCOURAGEMENT BANNER */}
      {languageAlertWords.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground shadow-md shrink-0"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <div className="flex-1">
            <span className="font-semibold">Great effort!</span> Non-English words detected (
            <span className="font-mono font-bold">{languageAlertWords.join(", ")}</span>). Let's try saying that sentence strictly in English!
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguageAlertWords([])}
            className="h-6 px-2 text-xs font-semibold"
          >
            Dismiss
          </Button>
        </motion.div>
      )}

      {/* 2. CENTER STAGE: 3D BABY HIPPO & ANIMATED SOUND RING & SPEECH BUBBLE */}
      <div className="relative flex flex-1 min-h-[340px] flex-col items-center justify-center rounded-3xl border border-border bg-gradient-to-b from-card/90 via-card/50 to-card/90 p-4 shadow-inner overflow-hidden">
        {/* State Status Tag */}
        <div className="absolute top-3 left-4 z-20 flex items-center gap-2">
          <Badge
            variant={
              isListening
                ? "destructive"
                : typing
                ? "secondary"
                : isSpeaking
                ? "success"
                : "outline"
            }
            className="px-3 py-1 text-xs font-semibold shadow-sm animate-fade-in"
          >
            {isListening && "🎤 Listening..."}
            {typing && "🤔 Baby Hippo is Thinking..."}
            {isSpeaking && "🔊 Speaking..."}
            {!isListening && !typing && !isSpeaking && "🦛 Ready to Chat"}
          </Badge>
        </div>

        {/* Toggle Transcript View Button */}
        <div className="absolute top-3 right-4 z-20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTranscript(!showTranscript)}
            className="h-8 gap-1.5 text-xs font-medium bg-card/60 backdrop-blur-sm hover:bg-card shadow-sm"
          >
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            {showTranscript ? "Hide Transcript" : "Show Transcript"}
            {showTranscript ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>

        {/* Floating Animated Speech Bubble */}
        <div className="absolute top-4 z-30 w-full max-w-md px-4 flex justify-center pointer-events-auto">
          <HippoSpeechBubble
            text={latestAssistantMessage}
            isTyping={typing}
            isSpeaking={isSpeaking}
            onReplayVoice={() => speakReply(latestAssistantMessage)}
          />
        </div>

        {/* 360 Degree Sound Wave Ring Background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <HippoSoundRing
            active={isListening || isSpeaking || typing || positiveSparkle || languageAlertWords.length > 0}
            mode={getHippoState()}
            barsCount={52}
            className="h-[320px] w-[320px]"
          />
        </div>

        {/* 3D Baby Hippo Mascot (Uncut, fully rendered in view with cursor eye tracking & poke reaction) */}
        <div className="relative z-10 my-auto flex h-[290px] w-[290px] items-center justify-center pointer-events-auto">
          <BabyHippo3D
            state={getHippoState()}
            audioVolume={isSpeaking ? 0.6 : 0}
            interactive={true}
            onPoke={() => toast("Giggle! Baby Hippo loves pets! 🦛✨", { icon: "🦛" })}
          />
        </div>
      </div>

      {/* 3. CONVERSATION TRANSCRIPT AREA (EXPANDABLE) */}
      <AnimatePresence>
        {showTranscript && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "160px" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="shrink-0"
          >
            <Card className="flex h-full flex-col overflow-hidden border-border bg-card/60 backdrop-blur-sm">
              <div
                ref={scrollRef}
                className="flex-1 space-y-2.5 overflow-y-auto p-3.5 scrollbar-thin text-xs"
              >
                {messages.length === 0 && !typing ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                    <p className="font-semibold text-sm">No conversation history yet</p>
                    <p className="text-xs">Tap the microphone below to start practicing with Baby Hippo!</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex gap-2.5",
                        m.role === "user" ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      <Avatar className="h-7 w-7 shrink-0 text-[10px] font-bold">
                        <AvatarFallback
                          className={
                            m.role === "assistant"
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary"
                          }
                        >
                          {m.role === "assistant" ? "🦛" : "YOU"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex max-w-[80%] flex-col gap-1">
                        <div
                          className={cn(
                            "rounded-2xl px-3.5 py-2 leading-relaxed shadow-sm",
                            m.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-foreground"
                          )}
                        >
                          {m.content}
                        </div>
                        {m.role === "assistant" && (
                          <button
                            onClick={() => speakReply(m.content)}
                            className="self-start text-[10px] font-semibold text-muted-foreground hover:text-primary flex items-center gap-1 px-1"
                          >
                            <Volume2 className="h-3 w-3" /> Replay
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. BOTTOM CONTROLS & MIC BUTTON */}
      <div className="shrink-0 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          {/* Main Microphone Button */}
          <Button
            variant={isListening ? "destructive" : "gradient"}
            size="lg"
            onClick={toggleListening}
            className={cn(
              "relative h-11 px-5 font-bold shadow-md transition-all active:scale-95 shrink-0 gap-2 rounded-xl text-xs sm:text-sm",
              isListening && "animate-pulse ring-4 ring-destructive/30"
            )}
          >
            {isListening ? (
              <>
                <MicOff className="h-4.5 w-4.5" /> Stop Speaking
              </>
            ) : (
              <>
                <Mic className="h-4.5 w-4.5" /> 🎤 Start Speaking
              </>
            )}
          </Button>

          {/* Text Input Fallback */}
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder={
              isListening
                ? "Baby Hippo is listening... Speak now..."
                : "Type or speak your answer in English..."
            }
            className="flex-1 h-11 text-xs sm:text-sm rounded-xl"
          />

          {/* Send Button */}
          <Button
            variant="gradient"
            size="icon"
            onClick={() => send(input)}
            disabled={!input.trim()}
            className="h-11 w-11 shrink-0 rounded-xl shadow-md"
          >
            <Send className="h-4.5 w-4.5" />
          </Button>
        </div>
      </div>

      {/* SESSION FEEDBACK SUMMARY MODAL */}
      {summaryData && (
        <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <Award className="h-6 w-6 text-primary" /> Baby Hippo Practice Feedback
              </DialogTitle>
              <DialogDescription>
                Comprehensive speaking skills summary and coaching analysis from your session.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border bg-secondary/40 p-3.5 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Overall Score</p>
                  <p className="mt-1 text-2xl font-bold text-primary">{summaryData.score}%</p>
                </div>
                <div className="rounded-xl border bg-secondary/40 p-3.5 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Fluency Score</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-500">{summaryData.fluencyScore}%</p>
                </div>
                <div className="rounded-xl border bg-secondary/40 p-3.5 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Fillers Used</p>
                  <p className="mt-1 text-2xl font-bold text-amber-500">{summaryData.fillerCount}</p>
                </div>
                <div className="rounded-xl border bg-secondary/40 p-3.5 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Language Alerts</p>
                  <p className="mt-1 text-2xl font-bold text-destructive">{summaryData.languageAlertsCount}</p>
                </div>
              </div>

              {summaryData.fillerCount > 0 && (
                <div className="rounded-xl border p-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-amber-500" /> Filler Words Used
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(summaryData.fillerBreakdown).map(([word, cnt]) => (
                      <Badge key={word} variant="secondary" className="px-3 py-1 text-xs">
                        "{word}": {cnt} time{cnt > 1 ? "s" : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {summaryData.grammarErrors.length > 0 && (
                <div className="rounded-xl border p-4 space-y-2">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Grammar & Expression Fixes
                  </h4>
                  <div className="space-y-2">
                    {summaryData.grammarErrors.map((g, idx) => (
                      <div key={idx} className="rounded-lg bg-secondary/50 p-2.5 text-xs space-y-1">
                        <p className="text-muted-foreground">Original: "{g.original}"</p>
                        <p className="font-medium text-foreground">💡 Tip: {g.tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border bg-primary/5 p-4 border-primary/20 space-y-2">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Coaching Takeaways
                </h4>
                <ul className="list-disc list-inside space-y-1 text-xs text-foreground/90">
                  {summaryData.coachingTips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="gradient" onClick={handleStartNewSession}>
                Done & Start New Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
