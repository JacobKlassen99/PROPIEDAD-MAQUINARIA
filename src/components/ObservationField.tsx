import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, AlertCircle } from 'lucide-react';
import { useI18n } from '../services/i18n';
import { FORM_LABEL_CLASS, FORM_TEXTAREA_CLASS } from './AppSelect';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function detectAndroidBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

function appendTranscriptSegment(base: string, segment: string): string {
  const cleanSeg = segment.replace(/\s+/g, ' ').trim();
  if (!cleanSeg) return base;
  const trimmedBase = base.trimEnd();
  if (!trimmedBase) return cleanSeg;
  if (/[,;:(¿¡-]$/.test(trimmedBase)) {
    return `${trimmedBase} ${cleanSeg}`;
  }
  return `${trimmedBase} ${cleanSeg}`;
}

/**
 * On Android Chrome/WebView, continuous SpeechRecognition often re-emits
 * cumulative or overlapping final phrases. Deduplicate safely.
 */
function mergeSpeechFragment(accumulated: string, incoming: string): string {
  const acc = accumulated.replace(/\s+/g, ' ').trim();
  const inc = incoming.replace(/\s+/g, ' ').trim();
  if (!inc) return acc;
  if (!acc) return inc;

  const accLower = acc.toLowerCase();
  const incLower = inc.toLowerCase();

  if (accLower === incLower) return acc;
  if (incLower.startsWith(accLower)) return inc;
  if (accLower.endsWith(incLower)) return acc;

  const accWords = acc.split(' ');
  const incWords = inc.split(' ');
  const maxOverlap = Math.min(accWords.length, incWords.length, 12);
  for (let overlap = maxOverlap; overlap >= 2; overlap--) {
    const tail = accWords.slice(accWords.length - overlap).join(' ').toLowerCase();
    const head = incWords.slice(0, overlap).join(' ').toLowerCase();
    if (tail === head) {
      const remainder = incWords.slice(overlap).join(' ');
      return remainder ? `${acc} ${remainder}` : acc;
    }
  }

  return `${acc} ${inc}`;
}

export interface ObservationFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  optional?: boolean;
  rows?: number;
  disabled?: boolean;
  className?: string;
  textareaClassName?: string;
  id?: string;
}

export const ObservationField: React.FC<ObservationFieldProps> = ({
  value,
  onChange,
  label,
  placeholder,
  optional = false,
  rows = 2,
  disabled = false,
  className = '',
  textareaClassName = '',
  id,
}) => {
  const { lang, t, speechLang, speechFallbackLang } = useI18n();

  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [voiceMessageType, setVoiceMessageType] = useState<'info' | 'error'>('info');

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const baseValueRef = useRef<string>(value);
  const latestValueRef = useRef<string>(value);
  const finalCommittedRef = useRef<string>('');
  const lastChunkRef = useRef<string>('');
  const triedFallbackRef = useRef<boolean>(false);
  const manualStopRef = useRef<boolean>(false);
  const sessionIdRef = useRef<number>(0);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const stopRecognition = useCallback((silent = false) => {
    manualStopRef.current = true;
    sessionIdRef.current += 1;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          // Ignore stop/abort race errors
        }
      }
    }
    setIsListening(false);
    setInterimText('');
    if (!silent) {
      setVoiceMessage(null);
    }
  }, []);

  // Stop active dictation when component unmounts or language changes
  useEffect(() => {
    return () => {
      stopRecognition(true);
    };
  }, [stopRecognition]);

  useEffect(() => {
    if (isListening) {
      stopRecognition(true);
    }
    setVoiceMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    if (disabled && isListening) {
      stopRecognition(true);
    }
  }, [disabled, isListening, stopRecognition]);

  const startRecognitionWithLang = useCallback(
    (targetLang: string, isFallbackAttempt: boolean) => {
      const Ctor = getSpeechRecognitionConstructor();
      if (!Ctor) {
        setVoiceMessageType('info');
        setVoiceMessage(t('voice.unsupported'));
        setIsListening(false);
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 40);
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch {
          // Ignore cleanup errors
        }
        recognitionRef.current = null;
      }

      const isAndroid = detectAndroidBrowser();
      const currentSession = ++sessionIdRef.current;
      manualStopRef.current = false;
      baseValueRef.current = latestValueRef.current;
      finalCommittedRef.current = '';
      lastChunkRef.current = '';
      setInterimText('');
      setVoiceMessage(null);

      try {
        const rec = new Ctor();
        rec.lang = targetLang;
        // Android Chrome repeats phrases heavily when continuous=true; single-utterance mode is clean & stable.
        rec.continuous = !isAndroid;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        rec.onstart = () => {
          if (sessionIdRef.current !== currentSession) return;
          setIsListening(true);
          setVoiceMessage(null);
        };

        rec.onresult = (event: SpeechRecognitionEventLike) => {
          if (sessionIdRef.current !== currentSession) return;
          let interimChunk = '';
          const results = event.results;

          if (isAndroid) {
            let latestFinal = '';
            let latestInterim = '';
            for (let i = 0; i < results.length; i++) {
              const res = results[i];
              const transcript = res && res[0] ? String(res[0].transcript || '').trim() : '';
              if (!transcript) continue;
              if (res.isFinal) {
                latestFinal = mergeSpeechFragment(latestFinal, transcript);
              } else {
                latestInterim = mergeSpeechFragment(latestInterim, transcript);
              }
            }
            if (latestFinal) {
              finalCommittedRef.current = mergeSpeechFragment(finalCommittedRef.current, latestFinal);
            }
            interimChunk = latestInterim;
          } else {
            const startIdx = typeof event.resultIndex === 'number' ? event.resultIndex : 0;
            for (let i = startIdx; i < results.length; i++) {
              const res = results[i];
              const transcript = res && res[0] ? String(res[0].transcript || '').trim() : '';
              if (!transcript) continue;
              if (res.isFinal) {
                if (transcript.toLowerCase() !== lastChunkRef.current.toLowerCase()) {
                  finalCommittedRef.current = mergeSpeechFragment(finalCommittedRef.current, transcript);
                  lastChunkRef.current = transcript;
                }
              } else {
                interimChunk = mergeSpeechFragment(interimChunk, transcript);
              }
            }
          }

          if (finalCommittedRef.current) {
            const merged = appendTranscriptSegment(baseValueRef.current, finalCommittedRef.current);
            if (merged !== latestValueRef.current) {
              latestValueRef.current = merged;
              onChange(merged);
            }
          }
          setInterimText(interimChunk);
        };

        rec.onerror = (event: SpeechRecognitionErrorEventLike) => {
          if (sessionIdRef.current !== currentSession) return;
          const code = String(event?.error || '').toLowerCase();

          if (
            (code === 'language-not-supported' || code === 'service-not-allowed') &&
            !isFallbackAttempt &&
            speechFallbackLang &&
            !triedFallbackRef.current
          ) {
            triedFallbackRef.current = true;
            recognitionRef.current = null;
            startRecognitionWithLang(speechFallbackLang, true);
            return;
          }

          setIsListening(false);
          setInterimText('');
          recognitionRef.current = null;

          if (code === 'aborted' && manualStopRef.current) {
            return;
          }

          if (code === 'not-allowed' || code === 'permission-denied') {
            setVoiceMessageType('error');
            setVoiceMessage(t('voice.permissionDenied'));
          } else if (code === 'no-speech') {
            setVoiceMessageType('info');
            setVoiceMessage(t('voice.noSpeech'));
          } else if (code === 'network') {
            setVoiceMessageType('error');
            setVoiceMessage(t('voice.networkError'));
          } else if (code === 'audio-capture') {
            setVoiceMessageType('error');
            setVoiceMessage(t('voice.audioCapture'));
          } else if (code === 'service-not-allowed' || code === 'language-not-supported') {
            setVoiceMessageType('info');
            setVoiceMessage(t('voice.unsupported'));
          } else {
            setVoiceMessageType('error');
            setVoiceMessage(t('voice.startError'));
          }
        };

        rec.onend = () => {
          if (sessionIdRef.current !== currentSession) return;
          setIsListening(false);
          setInterimText('');
          recognitionRef.current = null;
        };

        recognitionRef.current = rec;
        rec.start();
      } catch {
        setIsListening(false);
        setInterimText('');
        recognitionRef.current = null;
        setVoiceMessageType('info');
        setVoiceMessage(t('voice.unsupported'));
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 40);
      }
    },
    [onChange, speechFallbackLang, t]
  );

  const handleToggleDictate = () => {
    if (disabled) return;
    if (isListening) {
      stopRecognition(false);
      return;
    }
    triedFallbackRef.current = false;
    startRecognitionWithLang(speechLang, false);
  };

  const displayLabel = label ?? t('common.observation');
  const displayPlaceholder = placeholder ?? t('voice.placeholderDefault');

  return (
    <div className={`w-full min-w-0 ${className}`}>
      {displayLabel && (
        <label htmlFor={id} className={FORM_LABEL_CLASS}>
          {displayLabel}
          {optional && (
            <span className="ml-1 text-[11px] font-normal text-[#7A8780]">
              ({t('common.optional')})
            </span>
          )}
        </label>
      )}

      <div className="relative">
        <textarea
          ref={textareaRef}
          id={id}
          rows={rows}
          disabled={disabled}
          value={value}
          onChange={(e) => {
            const nextVal = e.target.value;
            latestValueRef.current = nextVal;
            if (isListening) {
              baseValueRef.current = nextVal;
              finalCommittedRef.current = '';
            }
            onChange(nextVal);
          }}
          placeholder={displayPlaceholder}
          className={`${FORM_TEXTAREA_CLASS} pr-11 ${
            isListening ? 'border-[#24875B] ring-2 ring-[#24875B]/20' : ''
          } ${textareaClassName}`}
        />

        <button
          type="button"
          disabled={disabled}
          onClick={handleToggleDictate}
          aria-pressed={isListening}
          aria-label={isListening ? t('voice.stopBtn') : t('voice.dictateBtn')}
          title={isListening ? t('voice.stopBtn') : t('voice.dictateBtn')}
          className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg border transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            isListening
              ? 'bg-[#C44545] border-[#C44545] text-white shadow-xs'
              : 'bg-[#F4F7F5] border-[#DCE4DF] text-[#24875B] hover:bg-[#EAF5EE] hover:border-[#24875B]/40'
          }`}
        >
          {isListening ? (
            <Square className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </button>
      </div>

      {isListening && (
        <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-[#24875B]/25 bg-[#EAF5EE]/80 px-2.5 py-1.5 text-[11px] font-medium text-[#1D5C3F]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-[#C44545] animate-pulse shrink-0" />
            <span className="truncate">
              {interimText ? `${t('voice.listening')} “${interimText}”` : t('voice.listening')}
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#24875B] shrink-0">
            {lang === 'es' ? 'ES' : 'EN'}
          </span>
        </div>
      )}

      {voiceMessage && !isListening && (
        <div
          className={`mt-1.5 flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] leading-snug ${
            voiceMessageType === 'error'
              ? 'bg-[#FCECEC] text-[#962D2D] border border-[#C44545]/25'
              : 'bg-[#F4F7F5] text-[#4E5E55] border border-[#DCE4DF]'
          }`}
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{voiceMessage}</span>
        </div>
      )}
    </div>
  );
};
