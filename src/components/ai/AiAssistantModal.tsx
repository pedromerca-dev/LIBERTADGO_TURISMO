import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  Film,
  Compass,
  MapPin,
  Calendar,
  AlertCircle
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
}

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  tripContext?: {
    destination?: string;
    startDate?: string;
    endDate?: string;
    places?: string[];
  };
}

const STORAGE_CREDITS_KEY = 'libertadgo_ai_credits_v1';
const MAX_FREE_CREDITS = 10;

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  initialPrompt,
  tripContext,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome_1',
      role: 'assistant',
      content: `¡Hola! Soy tu asistente de exploración y viaje de **RIYMO**.

Cuentas con **10 consultas gratuitas** para:
* 🗺️ **Diseñar itinerarios personalizados** para tu destino y fechas en La Libertad y el Perú.
* 🍲 **Recomendar gastronomía auténtica** (Ceviche con ají mochero, Shambar, Cabrito a la norteña).
* 🎬 **Generar ideas y guiones** para creadores turísticos y negocios locales.

¿Qué te gustaría explorar hoy?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputMessage, setInputMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Remaining free credits (out of 10)
  const [remainingCredits, setRemainingCredits] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_CREDITS_KEY);
      if (stored !== null) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch {
      // ignore
    }
    return MAX_FREE_CREDITS;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CREDITS_KEY, remainingCredits.toString());
    } catch {
      // ignore
    }
  }, [remainingCredits]);

  useEffect(() => {
    if (initialPrompt && isOpen) {
      setInputMessage(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    if (remainingCredits <= 0) {
      return;
    }

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          remainingCredits,
          context: {
            destination: tripContext?.destination || 'Trujillo',
            startDate: tripContext?.startDate || '2026-11-01',
            endDate: tripContext?.endDate || '2026-11-05',
            places: tripContext?.places || [],
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        const assistantMsg: Message = {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: data.modelUsed,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setRemainingCredits((prev) => Math.max(0, prev - 1));
      } else {
        throw new Error(data.error || 'Error al comunicarse con la IA');
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Lo siento, ocurrió un error temporal al procesar tu solicitud: ${err.message || 'Verifica la conexión'}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resetCredits = () => {
    setRemainingCredits(MAX_FREE_CREDITS);
  };

  const PROMPT_SUGGESTIONS = [
    {
      icon: Film,
      label: 'Guión video 30s para mi local',
      prompt: 'Redacta un guión viral de 30 segundos (Reels/TikTok) para mi restaurante en Huanchaco, enfocado en el ceviche tradicional con ají mochero y el llamado al voto para el concurso de los 3 primeros puestos.',
    },
    {
      icon: Compass,
      label: 'Itinerario de 3 días en La Libertad',
      prompt: `Diseña un itinerario de 3 días para mi viaje a ${tripContext?.destination || 'Trujillo y Huanchaco'} (${tripContext?.startDate || 'Día 1'} al ${tripContext?.endDate || 'Día 3'}) balanceando arqueología (Chan Chan, Huacas) y comida marina.`,
    },
    {
      icon: MapPin,
      label: 'Ruta gastronómica trujillana',
      prompt: '¿Cuáles son los 4 platos y restaurantes emblemáticos que no puedo perderme en Trujillo y Moche para esta semana?',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-2xl h-[88vh] max-h-[750px] shadow-2xl border border-[#E2E8F0] flex flex-col overflow-hidden">
        {/* Cabecera del Asistente */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#17243A] via-[#1E293B] to-[#0F172A] text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] p-0.5 flex items-center justify-center shadow-md">
              <div className="w-full h-full bg-[#17243A] rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[#FF8573]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white font-['Outfit']">
                  Planificar con RIYMO
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#E05A47]/30 text-[#FF8573] border border-[#E05A47]/40">
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Experto en itinerarios, fechas y guiones virales para locales
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Contador de 10 mensajes gratis */}
            <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>
                <strong className="text-[#FF8573]">{remainingCredits}</strong> / {MAX_FREE_CREDITS} gratis
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de progreso de créditos */}
        <div className="w-full bg-[#E2E8F0] h-1 shrink-0">
          <div
            className="bg-gradient-to-r from-[#E05A47] to-[#F59E0B] h-1 transition-all duration-300"
            style={{ width: `${(remainingCredits / MAX_FREE_CREDITS) * 100}%` }}
          />
        </div>

        {/* Área de Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#F8FAFC]">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-[#17243A] text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-xs">
                  <Bot className="w-4 h-4 text-[#FF8573]" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-xs text-xs sm:text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#17243A] text-white rounded-tr-xs'
                    : 'bg-white text-[#1E293B] border border-[#E9EEF4] rounded-tl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{m.content}</div>

                <div className="mt-2 pt-2 border-t border-slate-200/40 flex items-center justify-between text-[10px] text-[#94A3B8]">
                  <span>{m.timestamp}</span>
                  {m.role === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => handleCopy(m.id, m.content)}
                      className="hover:text-[#17243A] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check className="w-3 h-3 text-green-600" />
                          <span className="text-green-600">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar texto</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-[#E05A47] text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center text-xs text-[#64748B]">
              <div className="w-8 h-8 rounded-full bg-[#17243A] text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-[#FF8573] animate-spin" />
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#E9EEF4] shadow-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E05A47] animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-bounce delay-100" />
                <span className="w-2 h-2 rounded-full bg-[#17243A] animate-bounce delay-200" />
                <span>Generando respuesta experta con IA...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Píldoras de sugerencias rápidas */}
        {remainingCredits > 0 && (
          <div className="px-4 py-2 bg-white border-t border-[#E9EEF4] overflow-x-auto flex items-center gap-2 shrink-0 no-scrollbar">
            <span className="text-[11px] font-bold text-[#64748B] shrink-0">Sugerencias:</span>
            {PROMPT_SUGGESTIONS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(item.prompt)}
                  disabled={loading}
                  className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#1E293B] text-[11px] font-medium shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Icon className="w-3 h-3 text-[#E05A47]" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Input y Pie */}
        <div className="p-3 sm:p-4 bg-white border-t border-[#E9EEF4] shrink-0">
          {remainingCredits <= 0 ? (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs text-amber-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Has utilizado tus 10 mensajes gratuitos de IA para esta sesión.</span>
              </div>
              <button
                type="button"
                onClick={resetCredits}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs cursor-pointer"
              >
                Reiniciar 10 gratis
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Escribe tu consulta sobre lugares, fechas o guiones de video..."
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs sm:text-sm text-[#1E293B] focus:outline-hidden focus:border-[#E05A47] focus:ring-1 focus:ring-[#E05A47]"
              />
              <button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                className="px-4 py-2.5 rounded-xl bg-[#E05A47] hover:bg-[#D04936] disabled:opacity-50 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-[#E05A47]/20 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Enviar</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
