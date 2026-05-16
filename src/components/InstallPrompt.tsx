"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "bc:install-dismissed-at";
const DISMISS_DAYS = 7;

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 1) 서비스 워커 등록 (설치 가능 조건)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // 2) 이미 설치된 상태(standalone) 면 숨김
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    // 3) 최근 7일 내 X로 닫았으면 숨김
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86400_000) {
      setDismissed(true);
    }

    // 4) iOS 감지 (beforeinstallprompt 미지원 → 안내만)
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua));

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
      localStorage.removeItem(DISMISS_KEY);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;

  async function handleInstall() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") {
        setDeferred(null);
      }
    } catch {
      /* noop */
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }

  // iOS: 직접 설치 불가 → 가이드만 표시
  if (isIOS && !deferred) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-xs">
        <div className="flex items-start gap-2 rounded-2xl border border-sand-200 bg-white px-4 py-3 shadow-lg">
          <button
            type="button"
            onClick={() => setShowIOSHelp((v) => !v)}
            className="flex-1 text-left text-xs font-semibold text-sand-800"
          >
            📱 홈 화면에 설치하기
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="닫기"
            className="text-sand-400 hover:text-sand-600"
          >
            ×
          </button>
        </div>
        {showIOSHelp && (
          <div className="mt-2 rounded-xl border border-sand-200 bg-white px-4 py-3 text-[11px] leading-relaxed text-sand-700 shadow-lg">
            Safari 하단 <span className="font-semibold">공유 버튼</span> 탭 →
            <br />
            <span className="font-semibold">홈 화면에 추가</span> 선택 →
            <br />
            우측 상단 <span className="font-semibold">추가</span> 탭
          </div>
        )}
      </div>
    );
  }

  if (!deferred) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-2xl border border-sand-200 bg-white px-3 py-2 shadow-lg">
      <button
        type="button"
        onClick={handleInstall}
        className="flex items-center gap-2 rounded-xl bg-clay-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-clay-600"
      >
        <span aria-hidden>📥</span>
        앱으로 설치
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="나중에"
        className="rounded-full p-1 text-sand-400 hover:bg-sand-100 hover:text-sand-600"
      >
        ×
      </button>
    </div>
  );
}
