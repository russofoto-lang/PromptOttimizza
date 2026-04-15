import { useState, useRef, ChangeEvent } from "react";
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

const SYSTEM_PROMPT = `[ROLE]: Expert LLM prompt engineer. Responses are precise, actionable, zero filler.

[TASK]: Process user input and rewrite it as an optimized prompt for TARGET_MODEL.

[TARGET_MODEL]: Gemini-2.5-Flash
Optimize block order and density for this model.
Prefer concise blocks, JSON-compatible structure, minimal redundancy.

[PIPELINE]:
1. Strip politeness, hedging, filler words
2. Translate ALL context and actions to English
3. Standard Italian terms MUST be translated (e.g., "schede clienti" → "client profiles", "fasi della lavorazione" → "workflow stages")
4. Read [ACTIVE_CATEGORIES] from user message → inject matching TERMS_IT block
5. If [ACTIVE_CATEGORIES] is absent → [TERMS_IT]: none
6. Inject structured blocks in exact order below
7. Place [CONSTRAINTS] + [NEGATIVE_CONSTRAINTS] at END

[TERMS_IT_FOTO]: getting ready, first look, golden hour, reportage, matrimonio, cerimonia, sposa, ricevimento
[TERMS_IT_EVENTI]: Pro Loco, sagra, assessore, Comune, serata, SIAE, ingresso
[TERMS_IT_DEV]: Firebase, Render, Cloudflare, tenant, subdomain, webhook, deploy, PWA
[TERMS_IT_LEGALE]: GDPR, contratto, privacy, consenso, opt-in

RULE: If [ACTIVE_CATEGORIES] contains FOTO → populate [TERMS_IT] with TERMS_IT_FOTO values.
RULE: If [ACTIVE_CATEGORIES] contains EVENTI → populate [TERMS_IT] with TERMS_IT_EVENTI values.
RULE: If [ACTIVE_CATEGORIES] contains DEV → populate [TERMS_IT] with TERMS_IT_DEV values.
RULE: If [ACTIVE_CATEGORIES] contains LEGALE → populate [TERMS_IT] with TERMS_IT_LEGALE values.
RULE: Multiple categories → merge all matching TERMS_IT blocks, deduplicate.
RULE: [TERMS_IT] block MUST be omitted entirely if no categories are active.

[OUTPUT_SCHEMA]:
[ROLE]: {specific expert role}
[TASK]: {action verb + object, max 10 words}
[CONTEXT]: {minimum necessary context in English, no padding}
[TERMS_IT]: {comma-separated Italian terms from active categories — omit block if none}
[OUTPUT_FORMAT]: bullet | table | code | prose
[CONSTRAINTS]:
- Response language: {detect from user input}
- Scope: {define scope}
- {1 additional hard rule if needed}
[NEGATIVE_CONSTRAINTS]:
- No intros/outros
- No meta-commentary
- No apologies
- No hedging

[FORMAT_RULES]:
- Format lists with hyphens (-), not bullet points (•)
- [NEGATIVE_CONSTRAINTS] block MUST always be present, exact wording as above
- Never leave blocks empty — omit the block entirely if no value exists
- Never mix Italian and English within the same block

[CONSTRAINTS]:
- Output: only the optimized prompt, nothing else
- No explanation of the optimization process
- No confirmation requests
- No multiple variants unless [VARIANTS=true] in user message
- Temperature target: 0`;

const categories = [
  { id: "foto", label: "📸 Foto", terms: "matrimonio, reportage, getting ready, first look, golden hour, cerimonia, sposa, ricevimento" },
  { id: "eventi", label: "🎪 Eventi", terms: "Pro Loco, sagra, assessore, Comune, serata, spettacolo, SIAE, ingresso" },
  { id: "dev", label: "💻 Dev", terms: "Firebase, Render, Cloudflare, tenant, subdomain, webhook, deploy, PWA, backend" },
  { id: "legale", label: "⚖️ Legale", terms: "GDPR, contratto, privacy, consenso, opt-in, trattamento dati" },
];

export default function PromptOptimizer() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [tokenSaving, setTokenSaving] = useState<{input: number, output: number, saving: number} | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const toggleCategory = (id: string) => {
    setActiveCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const estimateTokens = (text: string) => Math.ceil(text.length / 4);

  const optimize = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setOutput("");
    setTokenSaving(null);

    const activeCatsString = activeCategories.map(id => id.toUpperCase()).join(", ");
    const userMessage = `[ACTIVE_CATEGORIES]: ${activeCatsString || "NONE"}
[TARGET_MODEL]: Gemini-2.5-Flash

${input}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userMessage,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.1,
        }
      });

      const result = response.text || "Errore nella risposta.";
      setOutput(result);

      const inputTokens = estimateTokens(input);
      const outputTokens = estimateTokens(result);
      const saving = Math.round(((inputTokens - outputTokens) / inputTokens) * 100);
      setTokenSaving({ input: inputTokens, output: outputTokens, saving });
    } catch (err) {
      console.error(err);
      setOutput("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setCharCount(e.target.value.length);
  };

  const copy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clear = () => {
    setInput("");
    setOutput("");
    setCharCount(0);
    setTokenSaving(null);
    textareaRef.current?.focus();
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      fontFamily: "'Courier New', monospace",
      color: "#e8e8e8",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        background: "#111",
        borderBottom: "1px solid #222",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px", fontWeight: "700", letterSpacing: "2px", color: "#fff" }}>
            PROMPT<span style={{ color: "#00ff88" }}>_</span>OPTIMA
          </span>
          <span style={{
            background: "#00ff88",
            color: "#000",
            fontSize: "12px",
            fontWeight: "700",
            padding: "2px 7px",
            borderRadius: "3px",
            letterSpacing: "1px",
          }}>v2.0</span>
        </div>
        <div style={{ fontSize: "13px", color: "#888", letterSpacing: "1px" }}>
          Gemini 2.5 Flash
        </div>
      </div>

      <div style={{ padding: "20px", maxWidth: "680px", margin: "0 auto" }}>

        {/* Category toggles */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", color: "#999", letterSpacing: "2px", marginBottom: "8px" }}>
            TERMS_IT ATTIVI
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "4px",
                  border: activeCategories.includes(cat.id)
                    ? "1px solid #00ff88"
                    : "1px solid #444",
                  background: activeCategories.includes(cat.id)
                    ? "rgba(0,255,136,0.1)"
                    : "#111",
                  color: activeCategories.includes(cat.id) ? "#00ff88" : "#888",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "'Courier New', monospace",
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input area */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}>
            <span style={{ fontSize: "12px", color: "#999", letterSpacing: "2px" }}>
              INPUT ITALIANO
            </span>
            <span style={{ fontSize: "12px", color: charCount > 0 ? "#aaa" : "#666" }}>
              {charCount} chars
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            placeholder="Scrivi qui quello che vuoi chiedere al modello..."
            rows={5}
            style={{
              width: "100%",
              background: "#111",
              border: "1px solid #444",
              borderRadius: "6px",
              color: "#e8e8e8",
              fontSize: "17px",
              padding: "14px",
              resize: "vertical",
              outline: "none",
              fontFamily: "'Courier New', monospace",
              lineHeight: "1.6",
              boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
            onFocus={e => e.target.style.borderColor = "#666"}
            onBlur={e => e.target.style.borderColor = "#444"}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button
            onClick={optimize}
            disabled={loading || !input.trim()}
            style={{
              flex: 1,
              padding: "13px",
              background: loading || !input.trim() ? "#111" : "#00ff88",
              color: loading || !input.trim() ? "#666" : "#000",
              border: "none",
              borderRadius: "6px",
              fontSize: "16px",
              fontWeight: "700",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              letterSpacing: "2px",
              fontFamily: "'Courier New', monospace",
              transition: "all 0.15s",
            }}
          >
            {loading ? "PROCESSING..." : "OPTIMIZE →"}
          </button>
          {(input || output) && (
            <button
              onClick={clear}
              style={{
                padding: "13px 18px",
                background: "#111",
                color: "#888",
                border: "1px solid #444",
                borderRadius: "6px",
                fontSize: "14px",
                cursor: "pointer",
                fontFamily: "'Courier New', monospace",
                letterSpacing: "1px",
              }}
            >
              RESET
            </button>
          )}
        </div>

        {/* Token stats */}
        {tokenSaving && (
          <div style={{
            display: "flex",
            gap: "12px",
            marginBottom: "16px",
            padding: "10px 14px",
            background: "#111",
            border: "1px solid #333",
            borderRadius: "6px",
          }}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "12px", color: "#888", letterSpacing: "1px" }}>INPUT</div>
              <div style={{ fontSize: "19px", color: "#bbb", fontWeight: "700" }}>~{tokenSaving.input}</div>
            </div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "12px", color: "#888", letterSpacing: "1px" }}>OUTPUT</div>
              <div style={{ fontSize: "19px", color: "#00ff88", fontWeight: "700" }}>~{tokenSaving.output}</div>
            </div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "12px", color: "#888", letterSpacing: "1px" }}>SAVING</div>
              <div style={{ fontSize: "19px", fontWeight: "700", color: tokenSaving.saving > 0 ? "#00ff88" : "#ff4444" }}>
                {tokenSaving.saving > 0 ? `-${tokenSaving.saving}%` : `+${Math.abs(tokenSaving.saving)}%`}
              </div>
            </div>
          </div>
        )}

        {/* Output area */}
        {(output || loading) && (
          <div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}>
              <span style={{ fontSize: "12px", color: "#999", letterSpacing: "2px" }}>
                PROMPT OTTIMIZZATO
              </span>
              {output && (
                <span style={{
                  fontSize: "12px",
                  color: "#777",
                  letterSpacing: "1px",
                }}>
                  STATUS: READY
                </span>
              )}
            </div>

            <div style={{
              background: "#0d0d0d",
              border: "1px solid #333",
              borderRadius: "6px",
              padding: "16px",
              fontSize: "16px",
              lineHeight: "1.8",
              color: "#eee",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              minHeight: "120px",
              position: "relative",
            }}>
              {loading ? (
                <span style={{ color: "#777", animation: "pulse 1s infinite" }}>
                  Ottimizzando...
                </span>
              ) : (
                output.split("\n").map((line, i) => {
                  const isBlock = line.match(/^\[.+\]:/);
                  return (
                    <div key={i} style={{
                      color: isBlock ? "#00ff88" : "#ddd",
                      fontWeight: isBlock ? "700" : "400",
                      marginBottom: isBlock ? "2px" : "0",
                    }}>
                      {line || "\u00A0"}
                    </div>
                  );
                })
              )}
            </div>

            {output && (
              <button
                onClick={copy}
                style={{
                  width: "100%",
                  marginTop: "10px",
                  padding: "13px",
                  background: copied ? "rgba(0,255,136,0.15)" : "#111",
                  color: copied ? "#00ff88" : "#bbb",
                  border: copied ? "1px solid #00ff88" : "1px solid #444",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "700",
                  cursor: "pointer",
                  letterSpacing: "2px",
                  fontFamily: "'Courier New', monospace",
                  transition: "all 0.2s",
                }}
              >
                {copied ? "✓ COPIATO" : "⎘ COPIA PROMPT"}
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; }
        textarea::placeholder { color: #555; }
        @keyframes pulse { 0%,100% { opacity:0.4 } 50% { opacity:1 } }
      `}</style>
    </div>
  );
}
