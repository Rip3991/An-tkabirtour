import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="fixed top-2.5 right-2.5 z-20 flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-stone-950 shadow-lg hover:bg-amber-400 transition-colors whitespace-nowrap"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Uygulamayı Yükle</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="fixed top-2.5 right-2.5 z-20 flex items-center gap-1.5 rounded-lg bg-[#12161f]/90 border border-white/15 px-3 py-1.5 text-xs font-medium text-amber-200 hover:text-white transition-colors whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Ana Ekrana Ekle</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-xl bg-[#12161f] border border-white/15 p-5 shadow-2xl text-stone-100">
              <h3 className="text-base font-semibold text-amber-200">iPhone / iPad’e Yükle</h3>
              <p className="mt-2 text-xs text-stone-300 leading-relaxed">
                1. Safari alt menüsündeki <strong>Paylaş</strong> simgesine dokunun.
                <br />
                2. Aşağı kaydırıp <strong>Ana Ekrana Ekle</strong> seçeneğine basın.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-amber-500 py-2 text-xs font-semibold text-stone-950 hover:bg-amber-400"
              >
                Kapat
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
