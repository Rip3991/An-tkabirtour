import { useEffect, useState } from 'react';

const ATATURK_QUOTES = [
  'Ne mutlu Türküm diyene!',
  'Yurtta sulh, cihanda sulh.',
  'Benim naçiz vücudum elbet bir gün toprak olacaktır, ancak Türkiye Cumhuriyeti ilelebet payidar kalacaktır.',
  'Hayatta en hakiki mürşit ilimdir.',
  'Egemenlik, kayıtsız şartsız milletindir.',
  'Vatanını en çok seven, görevini en iyi yapandır.',
  'Beni görmek demek mutlaka yüzümü görmek değildir. Benim fikirlerimi, benim duygularımı anlıyorsanız ve hissediyorsanız bu kafidir.',
  'Türk Milleti çalışkandır, Türk Milleti zekidir.',
];

export function AtaturkQuoteBanner() {
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let hideTimer = 0;
    let nextTimer = 0;
    let cancelled = false;

    const scheduleCycle = () => {
      hideTimer = window.setTimeout(() => {
        if (cancelled) return;
        setVisible(false);
        nextTimer = window.setTimeout(() => {
          if (cancelled) return;
          setQuoteIdx((prev) => (prev + 1) % ATATURK_QUOTES.length);
          setVisible(true);
          scheduleCycle();
        }, 7500);
      }, 6500);
    };

    scheduleCycle();

    return () => {
      cancelled = true;
      clearTimeout(hideTimer);
      clearTimeout(nextTimer);
    };
  }, []);

  return (
    <div
      className={`pointer-events-none fixed top-14 sm:top-3.5 left-1/2 -translate-x-1/2 z-15 w-[min(560px,92vw)] transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="px-4 py-2 rounded-xl bg-[#12161f]/88 border border-amber-400/30 text-center shadow-lg">
        <p className="font-display text-xs sm:text-sm text-amber-100 leading-snug">
          “{ATATURK_QUOTES[quoteIdx]}”
        </p>
        <p className="mt-0.5 text-[10px] tracking-wider uppercase text-amber-400/90 font-medium">
          Mustafa Kemal Atatürk
        </p>
      </div>
    </div>
  );
}
