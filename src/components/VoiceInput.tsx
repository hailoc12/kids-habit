'use client';
// Voice input cho trẻ chưa gõ được bàn phím — Web Speech API (vi-VN)
// Safari iOS 14.5+ & Chrome hỗ trợ; không hỗ trợ thì ẩn nút mic (honest state)
import { useEffect, useRef, useState } from 'react';

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;      // textarea thay vì input
  rows?: number;
  className?: string;
  maxLength?: number;
  autoFocus?: boolean;
};

/** nhận diện giọng nói → append vào ô nhập (không ghi đè phần đã có) */
export function useSpeechToText(onText: (t: string) => void) {
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  function toggle() {
    if (listening) { recRef.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'vi-VN';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
      onText(text.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return { listening, supported, toggle };
}

export default function VoiceInput({ value, onChange, placeholder, multiline, rows = 3, className = '', maxLength, autoFocus }: Props) {
  const { listening, supported, toggle } = useSpeechToText((t) => onChange(value ? `${value.trim()} ${t}` : t));

  const field = multiline ? (
    <textarea className={`input ${rows === 3 ? 'h-24' : ''} flex-1 min-w-0 ${className}`} rows={rows} value={value}
      onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} autoFocus={autoFocus} />
  ) : (
    <input className={`input flex-1 min-w-0 ${className}`} value={value}
      onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} autoFocus={autoFocus} />
  );

  return (
    <div className="flex gap-2 items-start">
      {field}
      {supported && (
        <button type="button" onClick={toggle} aria-label={listening ? 'dừng nói' : 'nói vào đây'}
          className={`shrink-0 w-12 h-12 rounded-2xl text-2xl flex items-center justify-center transition
            ${listening ? 'bg-red-500 text-white animate-pulse shadow-lg' : 'bg-white shadow-sm text-star-deep'}`}>
          {listening ? '⏹' : '🎤'}
        </button>
      )}
    </div>
  );
}
