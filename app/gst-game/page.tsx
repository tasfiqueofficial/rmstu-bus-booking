"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";

type ThrowEffect = {
  id: number;
  targetX: number;
  targetY: number;
  side: "left" | "right";
};

const TOTAL_CHANCES = 5;
const HIT_SCORE = 20;
const MISS_PENALTY = 2.5;

const GAME_IMAGE_URL = "https://m.media-amazon.com/images/M/MV5BNTNhNDkwMzUtNmM3Ny00ZjNkLTg1NTYtZjljOWVhYjhjYjA1XkEyXkFqcGc@._V1_.jpg"; // placeholder image

const getRandomTarget = () => {
  const x = 15 + Math.random() * 70;
  const y = 15 + Math.random() * 70;
  return { x, y };
};

export default function GSTGamePage() {
  const [chancesLeft, setChancesLeft] = useState(TOTAL_CHANCES);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [score, setScore] = useState(0);
  const [target, setTarget] = useState(getRandomTarget());
  const [message, setMessage] = useState("জয়েন করে প্রথম ক্লিক কর! জুতা মারো");
  const [gameOver, setGameOver] = useState(false);
  const [strikeEffects, setStrikeEffects] = useState<
    { id: number; x: number; y: number; hit: boolean }[]
  >([]);
  const [throwEffects, setThrowEffects] = useState<ThrowEffect[]>([]);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const probability = useMemo(() => {
    const value = Math.max(0, Math.min(100, score));
    return Number(value.toFixed(1));
  }, [score]);

  const resultText = useMemo(() => {
    if (!gameOver) return "";
    if (probability >= 80) return "অসাধারণ! তোমার GST পরীক্ষায় খুব ভালো হওয়ার সম্ভাবনা বেশি। ইনশাআল্লাহ।";
    if (probability >= 50) return "ভালো এক্সাম প্ল্যান, আরও অনুশীলন দরকার।";
    return "ধৈর্য ধরো, আরো প্রস্তুতি নেওয়ার প্রয়োজন।";
  }, [gameOver, probability]);

  const clickHandle = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (gameOver) return;
    const img = imageRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const xPercent = ((event.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((event.clientY - rect.top) / rect.height) * 100;

    const distance = Math.hypot(xPercent - target.x, yPercent - target.y);
    const hit = distance <= 12;

    const effectId = Date.now();
    setStrikeEffects((prev) => [
      ...prev,
      { id: effectId, x: xPercent, y: yPercent, hit },
    ]);
    setTimeout(() => {
      setStrikeEffects((prev) => prev.filter((item) => item.id !== effectId));
    }, 600);

    // throw two shoes from left and right
    const leftId = effectId + 1;
    const rightId = effectId + 2;
    setThrowEffects((prev) => [
      ...prev,
      { id: leftId, targetX: xPercent, targetY: yPercent, side: "left" },
      { id: rightId, targetX: xPercent, targetY: yPercent, side: "right" },
    ]);
    setTimeout(() => {
      setThrowEffects((prev) => prev.filter((item) => item.id !== leftId && item.id !== rightId));
    }, 700);

      const playShoeSound = () => {
      const webkitAudioContext = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const AudioContextClass = window.AudioContext || webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = hit ? 180 : 120;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 120);
    };
    playShoeSound();

    if (hit) {
      setHits((prev) => prev + 1);
      setScore((prev) => prev + HIT_SCORE);
      setMessage("হিট! +20% পাওয়ার সম্ভাবনা (সুষম টার্গেটে) 🎯");
    } else {
      setMisses((prev) => prev + 1);
      setScore((prev) => prev - MISS_PENALTY);
      setMessage("মিস! -2.5% পাওয়ার সম্ভাবনা। আবার চেষ্টা করো।");
    }

    setChancesLeft((prev) => {
      const remaining = prev - 1;
      if (remaining <= 0) {
        setGameOver(true);
      }
      return remaining;
    });

    setTarget(getRandomTarget());
  };

  const resetGame = () => {
    setChancesLeft(TOTAL_CHANCES);
    setHits(0);
    setMisses(0);
    setScore(0);
    setTarget(getRandomTarget());
    setMessage("আবার শুরু কর! আপনার GST সম্ভাবনা দেখাবে।");
    setGameOver(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-100 to-white p-4 text-slate-800">
      <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-sky-300 bg-white/80 p-5 shadow-lg">
        <h1 className="text-2xl font-bold text-center text-teal-800">বাসে বসে বসে গেইম খেলে এক্সাম দিতে যাও</h1>
        <p className="text-center text-sm text-slate-600">এক্সাম ভালো হবে ইনশাআল্লাহ</p>

        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-center ">আপনার অ্যাসাইন করা মোট চ্যান্স: {TOTAL_CHANCES}</div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">হিট: {hits}</div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">মিস: {misses}</div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">রিমেইনিং: {chancesLeft}</div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">GST সম্ভাবনা: {probability}%</div>
        </div>

        <div
          className="relative mx-auto max-w-xl cursor-crosshair overflow-hidden rounded-lg border border-slate-300 bg-white"
          onClick={clickHandle}
        >
          <img
            ref={imageRef}
            src={GAME_IMAGE_URL}
            alt="জুতা মারো" 
            className="h-80 w-full object-cover"
          />
          {!gameOver && (
            <>
              <div
                className="pointer-events-none absolute rounded-full border-4 border-red-400/80 bg-red-400/20 animate-pulse"
                style={{
                  left: `${target.x}%`,
                  top: `${target.y}%`,
                  width: "2.5rem",
                  height: "2.5rem",
                  transform: "translate(-50%, -50%)",
                }}
              ></div>
              <div
                className="pointer-events-none absolute rounded-full border-2 border-red-300/50"
                style={{
                  left: `${target.x}%`,
                  top: `${target.y}%`,
                  width: "4rem",
                  height: "4rem",
                  transform: "translate(-50%, -50%)",
                }}
              ></div>
            </>
          )}
          {throwEffects.map((effect) => (
            <div
              key={effect.id}
              className={`pointer-events-none absolute text-3xl animate-throw ${
                effect.side === "left" ? "text-indigo-700" : "text-purple-700"
              }`}
              style={
                {
                  left: effect.side === "left" ? "-12%" : "112%",
                  top: "90%",
                  "--target-x": `${effect.targetX}%`,
                  "--target-y": `${effect.targetY}%`,
                } as React.CSSProperties
              }
            >
              👟
            </div>
          ))}
          {strikeEffects.map((effect) => (
            <div
              key={effect.id}
              className={`pointer-events-none absolute text-3xl ${
                effect.hit ? "text-green-500" : "text-red-600"
              } animate-strike`}
              style={{
                left: `${effect.x}%`,
                top: `${effect.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              👟
            </div>
          ))}
        </div>

        <p className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700">{message}</p>

        {gameOver && (
          <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-center font-semibold text-green-900">{resultText}</div>
        )}

        <div className="flex justify-center gap-3">
          <button
            onClick={resetGame}
            className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800"
          >
            রিস্টার্ট গেম
          </button>
          {gameOver && (
            <Link
              href="/"
              className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-sm font-bold text-sky-700 hover:bg-sky-50"
            >
              মূল পেজে ফিরে যাও
            </Link>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-100 p-3 text-xs text-slate-600">
          নির্দেশ: ছবি একটা লোড হবে এবং প্রতি ক্লিকে টার্গেটে জুতা মারলে হিট হবে। হিট করলে +20% পেয়ে যাও, মিস করলে -2.5%। 5 টা চ্যান্স শেষে সম্ভাব্যতা দেখাবে।
        </div>
      </div>
    </main>
  );
}
