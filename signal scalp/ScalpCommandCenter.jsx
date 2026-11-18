import { useState, useEffect, useRef } from "react";

const COINS = [
  { symbol:"BTC", pair:"BTCUSDT", price:76875, change24h:+0.25, vol:"High", oi:"Flat", funding:"+0.003%", sentiment:"Neutral" },
  { symbol:"ETH", pair:"ETHUSDT", price:2104, change24h:-0.60, vol:"Medium", oi:"Flat", funding:"+0.001%", sentiment:"Neutral" },
  { symbol:"SOL", pair:"SOLUSDT", price:85.25, change24h:+0.90, vol:"Medium", oi:"Down", funding:"-0.002%", sentiment:"Bearish" },
  { symbol:"HYPE", pair:"HYPEUSDT", price:63.09, change24h:+9.5, vol:"Very High", oi:"Rising", funding:"+0.022%", sentiment:"Bullish" },
  { symbol:"ZEC", pair:"ZECUSDT", price:662, change24h:+5.2, vol:"High", oi:"Rising", funding:"+0.006%", sentiment:"Bullish" },
];

const MACRO_TEXT = "BTC.D ~60% (Mixed) | F&G: ~52 Neutral | BTC $76.9K (off ATH $126K) | HYPE ATH $64.24 kemarin — ETF inflows kuat | Goldman Sachs dump SOL ETF | ZEC whale accumulation aktif | OI BTC $7.6B · ETH $4.6B · SOL $805M";

const SYSTEM = `Kamu adalah AI trader profesional (quant-assisted discretionary) untuk scalping crypto di Bybit Perpetual.
PROFIL: Nathan, scalper aktif, analisis mendalam, Bybit Perpetual USDT.

RISK RULES (HARD — NO EXCEPTION):
• Leverage max 20x | Entry limit only | Max 3 posisi aktif
• Setelah 2 loss berturut-turut → STOP TRADING hari itu

TIMEFRAME: HTF Bias H4 | Entry M15/M5 | WAJIB multi-TF alignment (tidak boleh konflik)

NO TRADE JIKA (STRICT FILTER):
• Tidak ada BOS/CHOCH jelas | Tidak ada liquidity sweep | Market choppy/sideways
• Ada high impact news (CPI, FOMC, dll) | Konflik besar antar indikator utama

CONFLICT RESOLUTION HIERARCHY (WAJIB IKUTI):
On-chain (BTC.D + OI + Funding) > Struktur Market > Indikator Teknikal
→ Konflik tidak bisa diselesaikan = NO TRADE

ANALISIS WAJIB (SEMUA HARUS SEARAH):
1. Market Structure: BOS/CHOCH jelas, trend H4 valid, S/R penting
2. Liquidity: Equal highs/lows — sweep HARUS terjadi sebelum entry — entry HANYA setelah sweep+rejection
3. Entry Logic: SETIAP LEVEL WAJIB ada alasan spesifik (OB/FVG/discount/premium zone) | RR min 1:2
4. Indicator (konfirmasi saja): RSI, Stochastic, MACD, Volume
5. Elliott Wave: identifikasi wave, tidak boleh invalid
6. Fundamental: tidak ada news besar, narrative pasar mendukung
7. On-Chain (PRIORITAS TINGGI):
   BTC.D naik → hindari long alt; BTC.D turun → cari long alt
   OI naik + harga naik → bullish continuation; OI naik + harga turun → bearish continuation
   Funding terlalu positif → potensi short; Funding negatif → potensi long squeeze

CONFIDENCE SCORING — checklist 10 poin (✔/✘):
1. Struktur market jelas
2. Liquidity sweep valid
3. Entry di zona optimal (OB/FVG/discount/premium)
4. RR ≥ 1:2
5. Indikator mendukung
6. Elliott Wave valid
7. Fundamental mendukung
8. BTC Dominance mendukung
9. OI mendukung
10. Funding tidak crowded

10/10 atau 9/10 = score 9/10 | 8/10 = score 8/10 | ≤7/10 = SKIP TOTAL (jangan tampilkan)
Score < 8 → TIDAK BOLEH ditampilkan. Trade management: score ≥ 8 → TP1 then SL ke BE then TP2.

FORMAT OUTPUT WAJIB (gunakan persis ini, tanpa modifikasi):

---
COIN: [PAIR]
BIAS: [LONG / SHORT]

ALASAN:
[1 paragraf konkret: struktur + liquidity + on-chain + wave — tidak ambigu]

ENTRY: $X,XXX — [alasan level: OB/FVG/discount zone/dll]
SL: $X,XXX — [alasan: di luar struktur apa / invalidation point mana]
TP1: $X,XXX — [target liquidity / resistance mana]
TP2: $X,XXX — [extension target mana]

CHECKLIST:
✔/✘ Struktur market jelas
✔/✘ Liquidity sweep valid
✔/✘ Entry di zona optimal
✔/✘ RR ≥ 1:2
✔/✘ Indikator mendukung
✔/✘ Elliott Wave valid
✔/✘ Fundamental mendukung
✔/✘ BTC.D mendukung
✔/✘ OI mendukung
✔/✘ Funding tidak crowded

SCORE: X/10
RISK: [perhitungan size/posisi singkat]
INVALIDASI: [kondisi spesifik yang batalkan setup]
TIME LIMIT: [X jam — reasoning kenapa batas waktu segitu]
RE-ENTRY: [kondisi boleh entry ulang jika kena SL]
CONFIDENCE: [TP1 only / TP1 + TP2]
---

Jika tidak ada setup yang memenuhi standar: ⛔ NO VALID SETUP — [alasan singkat]. Maksimal 3 setup.`;

const S_KEY = "scalp_j_v3";
const loadJ = async () => {
  try { const r = await window.storage.get(S_KEY); return r ? JSON.parse(r.value) : []; }
  catch { return []; }
};
const saveJ = async (j) => {
  try { await window.storage.set(S_KEY, JSON.stringify(j)); } catch {}
};

const fp = (n) => {
  if (!n && n !== 0) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(4);
};

function parseSetups(text) {
  const setups = [];
  const blocks = text.split(/\n---+\n/);
  for (const b of blocks) {
    const coin = b.match(/COIN:\s*([A-Z0-9]+)/i)?.[1]?.toUpperCase();
    const bias = b.match(/BIAS:\s*(LONG|SHORT)/i)?.[1]?.toUpperCase();
    const score = parseInt(b.match(/SCORE:\s*(\d+)\s*\/\s*10/i)?.[1] || "0");
    if (!coin || !bias || score < 8) continue;
    const pn = (rx) => { const m = b.match(rx); return m ? parseFloat(m[1].replace(/,/g, "")) : null; };
    setups.push({
      pair: coin, direction: bias, score,
      entry: pn(/ENTRY:\s*\$?([\d,]+\.?\d*)/i),
      sl: pn(/\nSL:\s*\$?([\d,]+\.?\d*)/i),
      tp1: pn(/TP1:\s*\$?([\d,]+\.?\d*)/i),
      tp2: pn(/TP2:\s*\$?([\d,]+\.?\d*)/i),
    });
  }
  return setups;
}

function calcRR(entry, sl, tp) {
  const e = parseFloat(entry), s = parseFloat(sl), t = parseFloat(tp);
  if (!e || !s || !t) return null;
  const risk = Math.abs(e - s), reward = Math.abs(t - e);
  return risk > 0 ? (reward / risk).toFixed(2) : null;
}

function Ticker({ coins }) {
  return (
    <div style={{ display: "flex", gap: 22, overflowX: "auto", padding: "6px 0", scrollbarWidth: "none" }}>
      {coins.map(c => (
        <div key={c.symbol} style={{ flexShrink: 0, textAlign: "center", minWidth: 58 }}>
          <div style={{ fontSize: 9, color: "#4a5568", marginBottom: 2, letterSpacing: "0.12em" }}>{c.symbol}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#dde4ec" }}>${fp(c.price)}</div>
          <div style={{ fontSize: 10, color: c.change24h >= 0 ? "#3fb950" : "#f85149", marginTop: 1 }}>
            {c.change24h >= 0 ? "+" : ""}{c.change24h}%
          </div>
        </div>
      ))}
    </div>
  );
}

function ScoreBar({ score }) {
  const color = score >= 9 ? "#3fb950" : score >= 8 ? "#f0883e" : "#f85149";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0" }}>
      <div style={{ display: "flex", gap: 2 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} style={{ width: 16, height: 4, borderRadius: 2, background: i < score ? color : "#1c2631" }} />
        ))}
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{score}/10</span>
    </div>
  );
}

function PlanBlock({ block, setup, added, onAdd }) {
  const lines = block.trim().split("\n");
  return (
    <div style={{ marginBottom: 4 }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 3 }} />;
        if (/^⛔/.test(line)) return <div key={i} style={{ fontSize: 13, color: "#f0883e", fontWeight: 700, margin: "16px 0" }}>{line}</div>;
        if (/^COIN:/i.test(line)) {
          const val = line.replace(/^COIN:\s*/i, "");
          return <div key={i} style={{ fontSize: 14, fontWeight: 700, color: "#dde4ec", marginBottom: 5, letterSpacing: "0.02em" }}>◆ {val}</div>;
        }
        if (/^BIAS:/i.test(line)) {
          const val = line.replace(/^BIAS:\s*/i, "").trim();
          const isLong = /LONG/i.test(val);
          return (
            <div key={i} style={{
              display: "inline-block", padding: "3px 12px", borderRadius: 4, marginBottom: 10,
              background: isLong ? "#3fb95020" : "#f8514920",
              border: `1px solid ${isLong ? "#3fb95077" : "#f8514977"}`,
              color: isLong ? "#3fb950" : "#f85149", fontSize: 11, fontWeight: 700
            }}>
              {isLong ? "▲ LONG" : "▼ SHORT"}
            </div>
          );
        }
        if (/^SCORE:/i.test(line)) {
          const score = parseInt(line.match(/(\d+)/)?.[1] || "0");
          return <div key={i} style={{ marginBottom: 2 }}><ScoreBar score={score} /></div>;
        }
        if (/^CHECKLIST:/i.test(line)) return <div key={i} style={{ fontSize: 9, color: "#4a5568", marginTop: 10, marginBottom: 3, letterSpacing: "0.12em" }}>CHECKLIST</div>;
        if (/^ALASAN:/i.test(line)) return <div key={i} style={{ fontSize: 9, color: "#4a5568", marginTop: 10, marginBottom: 3, letterSpacing: "0.12em" }}>ALASAN</div>;
        if (/^[✔✘]/.test(line)) {
          const ok = line.startsWith("✔");
          return (
            <div key={i} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 5, lineHeight: "1.8", color: ok ? "#3fb950" : "#f85149" }}>
              <span>{ok ? "✔" : "✘"}</span>
              <span style={{ color: ok ? "#7d8590" : "#7d4040" }}>{line.slice(2)}</span>
            </div>
          );
        }
        const kv = line.match(/^(ENTRY|SL|TP1|TP2|RISK|INVALIDASI|TIME LIMIT|RE-ENTRY|CONFIDENCE):\s*(.*)/i);
        if (kv) {
          const key = kv[1].toUpperCase(), val = kv[2];
          const kc = { ENTRY: "#00e5ff", SL: "#f85149", TP1: "#3fb950", TP2: "#3fb950aa", RISK: "#f0883e", INVALIDASI: "#f85149aa", "TIME LIMIT": "#7d8590", "RE-ENTRY": "#7d8590", CONFIDENCE: "#00e5ff" }[key] || "#7d8590";
          return (
            <div key={i} style={{ fontSize: 12, display: "flex", gap: 8, lineHeight: "1.85", marginBottom: 1 }}>
              <span style={{ color: kc, fontWeight: 700, minWidth: 96, flexShrink: 0 }}>{key}</span>
              <span style={{ color: "#c9d1d9", flex: 1 }}>{val}</span>
            </div>
          );
        }
        return <div key={i} style={{ fontSize: 12, color: "#6a7585", lineHeight: "1.7" }}>{line}</div>;
      })}
      {setup && (
        <div style={{
          marginTop: 14, padding: "10px 14px",
          background: added ? "#101a10" : "#081408",
          border: `1px solid ${added ? "#3fb95030" : "#3fb95080"}`, borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8
        }}>
          <div style={{ fontSize: 11 }}>
            <span style={{ color: "#3fb950", fontWeight: 700 }}>✦ {setup.score}/10 · {setup.direction}</span>
            {setup.entry && <span style={{ color: "#556070", marginLeft: 10 }}>Entry ${fp(setup.entry)}</span>}
            {setup.sl && <span style={{ color: "#556070" }}> · SL ${fp(setup.sl)}</span>}
            {setup.tp1 && <span style={{ color: "#556070" }}> · TP1 ${fp(setup.tp1)}</span>}
          </div>
          <button
            onClick={() => !added && onAdd(setup)}
            style={{
              padding: "5px 14px", borderRadius: 4, fontFamily: "inherit", fontSize: 10,
              fontWeight: 700, cursor: added ? "default" : "pointer",
              border: `1px solid ${added ? "#3fb95030" : "#3fb950"}`,
              background: added ? "transparent" : "#3fb95018",
              color: added ? "#3a5a3a" : "#3fb950"
            }}
          >
            {added ? "✓ ADDED TO JOURNAL" : "+ ADD TO JOURNAL"}
          </button>
        </div>
      )}
    </div>
  );
}

function PlanRenderer({ text, addedPairs, onAdd }) {
  if (!text) return null;
  const setups = parseSetups(text);
  const setupMap = {};
  setups.forEach(s => { setupMap[s.pair] = s; });
  if (/NO VALID SETUP/i.test(text) && setups.length === 0) {
    return (
      <div style={{ padding: "30px 0", textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "#f0883e", fontWeight: 700, marginBottom: 6 }}>⛔ NO VALID SETUP</div>
        <div style={{ fontSize: 12, color: "#556070" }}>{text.replace(/⛔\s*NO VALID SETUP\s*[—-]?\s*/i, "").trim()}</div>
      </div>
    );
  }
  const blocks = text.split(/\n---+\n/);
  return (
    <div>
      {blocks.map((block, bi) => {
        const coinMatch = block.match(/COIN:\s*([A-Z0-9]+)/i);
        const pair = coinMatch?.[1]?.toUpperCase();
        const setup = pair ? setupMap[pair] : null;
        const added = setup ? addedPairs.has(setup.pair) : false;
        return (
          <div key={bi}>
            {bi > 0 && <hr style={{ border: "none", borderTop: "1px solid #131a22", margin: "16px 0" }} />}
            <PlanBlock block={block} setup={setup} added={added} onAdd={onAdd} />
          </div>
        );
      })}
    </div>
  );
}

function JournalForm({ prefill, editIdx, onSave, onCancel, timeframe }) {
  const init = prefill || { pair: "", direction: "Long", confidence: 0, entry: "", sl: "", tp1: "", tp2: "", result: "", pnl: "", timeframe: timeframe || "5m", notes: "" };
  const [f, setF] = useState(init);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const rr = calcRR(f.entry, f.sl, f.tp1);
  const rrNum = rr ? parseFloat(rr) : 0;
  const pnlNum = parseFloat(f.pnl) || 0;
  const pnlWarnLoss = f.result === "Loss" && pnlNum > 0;
  const pnlWarnWin = f.result === "Win" && pnlNum < 0;

  const handleResult = (v) => {
    setF(p => {
      let pnl = parseFloat(p.pnl) || 0;
      if (v === "Loss" && pnl > 0) pnl = -Math.abs(pnl);
      if (v === "Win" && pnl < 0) pnl = Math.abs(pnl);
      if (v === "BE") pnl = 0;
      return { ...p, result: v, pnl: pnl === 0 ? "0" : pnl.toString() };
    });
  };

  const handleSave = () => {
    if (!f.pair || !f.result) return;
    let pnl = parseFloat(f.pnl) || 0;
    if (f.result === "Loss") pnl = -Math.abs(pnl);
    else if (f.result === "Win") pnl = Math.abs(pnl);
    else pnl = 0;
    onSave({
      ...f,
      pnl,
      entry: parseFloat(f.entry) || 0,
      sl: parseFloat(f.sl) || 0,
      tp1: parseFloat(f.tp1) || 0,
      tp2: parseFloat(f.tp2) || 0,
      confidence: parseInt(f.confidence) || 0,
      date: f.date || new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
      time: f.time || new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    }, editIdx);
  };

  const IS = { background: "#070b0f", border: "1px solid #1c2631", color: "#c9d1d9", padding: "7px 10px", borderRadius: 5, fontFamily: "inherit", fontSize: 12, width: "100%", outline: "none" };
  const LS = { fontSize: 9, color: "#4a5568", marginBottom: 4, letterSpacing: "0.1em" };
  const rc = f.result === "Win" ? "#3fb950" : f.result === "Loss" ? "#f85149" : f.result === "BE" ? "#f0883e" : "#1c2631";

  return (
    <div style={{ background: "#080f14", border: "1px solid #1a3040", borderRadius: 8, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: "#00e5ff", fontWeight: 700, marginBottom: 12, letterSpacing: "0.06em" }}>
        {prefill ? "◎ ADD TRADE FROM PLAN" : editIdx !== null ? "✎ EDIT TRADE" : "+ LOG TRADE MANUAL"}
      </div>
      {prefill && (
        <div style={{ fontSize: 10, color: "#3fb950", background: "#3fb95010", border: "1px solid #3fb95033", borderRadius: 4, padding: "5px 10px", marginBottom: 12 }}>
          ✦ Auto-filled dari plan — isi Result dan PnL setelah trade selesai
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div><div style={LS}>PAIR</div><input style={IS} value={f.pair} onChange={e => set("pair", e.target.value.toUpperCase())} placeholder="BTCUSDT" /></div>
        <div><div style={LS}>DIRECTION</div>
          <select style={IS} value={f.direction} onChange={e => set("direction", e.target.value)}>
            <option>Long</option><option>Short</option>
          </select>
        </div>
        <div><div style={LS}>CONFIDENCE</div>
          <input style={{ ...IS, borderColor: f.confidence >= 8 ? "#3fb95055" : "#1c2631", color: f.confidence >= 8 ? "#3fb950" : "#c9d1d9" }}
            type="number" min="1" max="10" value={f.confidence} onChange={e => set("confidence", e.target.value)} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div><div style={LS}>ENTRY $</div><input style={IS} type="number" value={f.entry} onChange={e => set("entry", e.target.value)} /></div>
        <div><div style={LS}>STOP LOSS $</div><input style={{ ...IS, borderColor: f.sl ? "#f8514933" : "#1c2631" }} type="number" value={f.sl} onChange={e => set("sl", e.target.value)} /></div>
        <div>
          <div style={LS}>TP1 $ {rr && <span style={{ marginLeft: 4, color: rrNum >= 2 ? "#3fb950" : "#f85149" }}>RR 1:{rr}</span>}</div>
          <input style={{ ...IS, borderColor: rr ? (rrNum >= 2 ? "#3fb95055" : "#f8514955") : "#1c2631" }} type="number" value={f.tp1} onChange={e => set("tp1", e.target.value)} />
        </div>
        <div><div style={LS}>TP2 $ (opsional)</div><input style={IS} type="number" value={f.tp2} onChange={e => set("tp2", e.target.value)} /></div>
      </div>
      {rr && (
        <div style={{ fontSize: 11, padding: "5px 10px", borderRadius: 4, marginBottom: 10, background: rrNum >= 2 ? "#3fb95010" : "#f8514910", border: `1px solid ${rrNum >= 2 ? "#3fb95033" : "#f8514933"}`, color: rrNum >= 2 ? "#3fb950" : "#f85149" }}>
          {rrNum >= 2 ? "✔" : "✘"} RR aktual 1:{rr} {rrNum >= 2 ? "— memenuhi minimum 1:2" : "— kurang dari minimum 1:2"}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div><div style={LS}>RESULT</div>
          <select style={{ ...IS, borderColor: `${rc}66`, color: f.result ? rc : "#c9d1d9" }} value={f.result} onChange={e => handleResult(e.target.value)}>
            <option value="">— pilih —</option><option value="Win">Win</option><option value="Loss">Loss</option><option value="BE">Break Even</option>
          </select>
        </div>
        <div><div style={LS}>PnL (USDT)</div>
          <input style={{ ...IS, borderColor: (pnlWarnLoss || pnlWarnWin) ? "#f0883e66" : "#1c2631" }}
            type="number" step="0.01" value={f.pnl} onChange={e => set("pnl", e.target.value)} placeholder="±0.00" />
        </div>
        <div><div style={LS}>TIMEFRAME</div>
          <select style={IS} value={f.timeframe} onChange={e => set("timeframe", e.target.value)}>
            {["1m", "3m", "5m", "15m", "1h", "4h"].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      {(pnlWarnLoss || pnlWarnWin) && (
        <div style={{ fontSize: 10, color: "#f0883e", background: "#f0883e0a", border: "1px solid #f0883e33", borderRadius: 4, padding: "5px 10px", marginBottom: 10 }}>
          ⚠ PnL {pnlWarnLoss ? "positif tapi result Loss" : "negatif tapi result Win"} — akan otomatis dikoreksi saat disimpan
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        <div style={LS}>NOTES</div>
        <textarea style={{ ...IS, resize: "vertical", minHeight: 52 }} value={f.notes} onChange={e => set("notes", e.target.value)} placeholder="Setup name, mistake, lesson learned..." />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={!f.pair || !f.result} style={{ padding: "8px 18px", borderRadius: 5, fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: !f.pair || !f.result ? "not-allowed" : "pointer", background: "#00e5ff18", border: "1px solid #00e5ff66", color: "#00e5ff", opacity: !f.pair || !f.result ? 0.4 : 1 }}>
          {editIdx !== null ? "SIMPAN PERUBAHAN" : "SIMPAN TRADE"}
        </button>
        <button onClick={onCancel} style={{ padding: "8px 14px", borderRadius: 5, fontFamily: "inherit", fontSize: 11, cursor: "pointer", background: "transparent", border: "1px solid #1c2631", color: "#556070" }}>BATAL</button>
      </div>
    </div>
  );
}

function JournalCard({ entry, idx, onEdit, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const rr = calcRR(entry.entry, entry.sl, entry.tp1);
  const rrNum = rr ? parseFloat(rr) : 0;
  const bc = entry.result === "Win" ? "#3fb95020" : entry.result === "Loss" ? "#f8514920" : "#1c2631";
  return (
    <div style={{ background: "#0d1117", border: `1px solid ${bc}`, borderRadius: 8, padding: "11px 14px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#dde4ec" }}>{entry.pair}</span>
            {[
              { val: entry.direction === "Long" ? "▲ LONG" : "▼ SHORT", c: entry.direction === "Long" ? "#3fb950" : "#f85149" },
              { val: entry.result === "Win" ? "✔ WIN" : entry.result === "Loss" ? "✘ LOSS" : "◯ BE", c: entry.result === "Win" ? "#3fb950" : entry.result === "Loss" ? "#f85149" : "#f0883e" },
            ].map((b, bi) => (
              <span key={bi} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 3, fontWeight: 700, background: `${b.c}18`, border: `1px solid ${b.c}44`, color: b.c }}>{b.val}</span>
            ))}
            {entry.confidence >= 8 && <span style={{ fontSize: 9, color: "#00e5ff66", padding: "2px 7px", borderRadius: 3, border: "1px solid #00e5ff22" }}>{entry.confidence}/10</span>}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: "#556070", marginBottom: entry.notes ? 4 : 0 }}>
            {entry.entry > 0 && <span>Entry <span style={{ color: "#c9d1d9" }}>${fp(entry.entry)}</span></span>}
            {entry.sl > 0 && <span>SL <span style={{ color: "#f85149" }}>${fp(entry.sl)}</span></span>}
            {entry.tp1 > 0 && <span>TP1 <span style={{ color: "#3fb950" }}>${fp(entry.tp1)}</span></span>}
            {rr && <span>RR <span style={{ color: rrNum >= 2 ? "#3fb950" : "#f0883e" }}>1:{rr}</span></span>}
            {entry.timeframe && <span>{entry.timeframe}</span>}
            {entry.date && <span style={{ color: "#3a4050" }}>{entry.date}{entry.time ? " " + entry.time : ""}</span>}
          </div>
          {entry.notes && <div style={{ fontSize: 11, color: "#3a5060", marginTop: 3 }}>{entry.notes}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: entry.pnl > 0 ? "#3fb950" : entry.pnl < 0 ? "#f85149" : "#556070" }}>
            {entry.pnl > 0 ? "+" : ""}{(entry.pnl || 0).toFixed(2)}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => onEdit(idx)} style={{ padding: "3px 9px", borderRadius: 3, fontFamily: "inherit", fontSize: 9, cursor: "pointer", background: "#00e5ff10", border: "1px solid #00e5ff33", color: "#00e5ff88" }}>✎ Edit</button>
            {!confirm
              ? <button onClick={() => setConfirm(true)} style={{ padding: "3px 9px", borderRadius: 3, fontFamily: "inherit", fontSize: 9, cursor: "pointer", background: "#f8514910", border: "1px solid #f8514933", color: "#f8514988" }}>✕ Hapus</button>
              : <span style={{ display: "flex", gap: 3 }}>
                <button onClick={() => onDelete(idx)} style={{ padding: "3px 9px", borderRadius: 3, fontFamily: "inherit", fontSize: 9, cursor: "pointer", background: "#f8514920", border: "1px solid #f85149", color: "#f85149", fontWeight: 700 }}>Hapus!</button>
                <button onClick={() => setConfirm(false)} style={{ padding: "3px 9px", borderRadius: 3, fontFamily: "inherit", fontSize: 9, cursor: "pointer", background: "transparent", border: "1px solid #1c2631", color: "#556070" }}>Batal</button>
              </span>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [capital, setCapital] = useState("500");
  const [risk, setRisk] = useState("1");
  const [leverage, setLeverage] = useState("10");
  const [timeframe, setTimeframe] = useState("5m");
  const [session, setSession] = useState("Asia");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState("");
  const [planTime, setPlanTime] = useState("");
  const [stream, setStream] = useState("");
  const [journal, setJournal] = useState([]);
  const [tab, setTab] = useState("plan");
  const [showForm, setShowForm] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [formPrefill, setFormPrefill] = useState(null);
  const [addedPairs, setAddedPairs] = useState(new Set());
  const streamRef = useRef("");

  useEffect(() => { loadJ().then(j => setJournal(j)); }, []);

  const riskUsdt = ((parseFloat(capital) || 0) * (parseFloat(risk) || 1) / 100).toFixed(2);
  const wins = journal.filter(j => j.result === "Win");
  const losses = journal.filter(j => j.result === "Loss");
  const winRate = journal.length > 0 ? ((wins.length / journal.length) * 100).toFixed(0) : null;
  const totalPnl = journal.reduce((s, j) => s + (j.pnl || 0), 0);
  const lossStreak = journal.length >= 2 && journal[0]?.result === "Loss" && journal[1]?.result === "Loss";

  const buildContext = () => {
    const lossCtx = losses.length > 0
      ? `\nTRADE LOSS TERKINI (JANGAN ULANGI POLA SERUPA):\n${losses.slice(0, 3).map(l => `- ${l.pair} ${l.direction} @ $${l.entry}: ${l.notes || "no notes"} → -$${Math.abs(l.pnl || 0).toFixed(2)}`).join("\n")}`
      : "";
    return `DATA MARKET (${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}):
Macro: ${MACRO_TEXT}
Harga:
${COINS.map(c => `${c.pair}: $${fp(c.price)} | 24h: ${c.change24h}% | Vol: ${c.vol} | OI: ${c.oi} | Funding: ${c.funding} | Sentiment: ${c.sentiment}`).join("\n")}
PARAMETER: Modal $${capital} USDT | Risk ${risk}% = $${riskUsdt} USDT | Leverage ${leverage}x | TF: ${timeframe} | Sesi: ${session}
${lossCtx}
TUGAS: Trading plan scalping hari ini. Filter ketat: confidence ≥ 8/10, RR ≥ 1:2. Maks 3 setup. Tidak ada yang layak → NO VALID SETUP.`;
  };

  const generatePlan = async () => {
    setLoading(true); setPlan(""); setStream(""); streamRef.current = "";
    setAddedPairs(new Set()); setTab("plan");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: SYSTEM, messages: [{ role: "user", content: buildContext() }] })
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "⛔ Gagal mendapat respons.";
      let i = 0;
      const tick = setInterval(() => {
        if (i < text.length) { streamRef.current += text[i]; setStream(streamRef.current); i += 10; }
        else { clearInterval(tick); setPlan(text); setStream(""); setPlanTime(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })); setLoading(false); }
      }, 14);
    } catch { setPlan("⛔ Gagal terhubung ke AI. Periksa koneksi."); setLoading(false); }
  };

  const handleAddFromPlan = (setup) => {
    setFormPrefill({
      pair: setup.pair,
      direction: setup.direction === "LONG" ? "Long" : "Short",
      confidence: setup.score,
      entry: setup.entry?.toString() || "",
      sl: setup.sl?.toString() || "",
      tp1: setup.tp1?.toString() || "",
      tp2: setup.tp2?.toString() || "",
      result: "", pnl: "", timeframe, notes: `Plan ${planTime || ""}`,
    });
    setEditIdx(null); setShowForm(true);
    setAddedPairs(prev => new Set([...prev, setup.pair]));
    setTab("journal");
  };

  const handleSave = async (entry, idx) => {
    const updated = idx !== null && idx !== undefined
      ? journal.map((j, i) => i === idx ? { ...j, ...entry } : j)
      : [entry, ...journal];
    setJournal(updated); await saveJ(updated);
    setShowForm(false); setEditIdx(null); setFormPrefill(null);
  };

  const handleEdit = (idx) => {
    const e = journal[idx];
    setFormPrefill({ ...e, entry: e.entry?.toString() || "", sl: e.sl?.toString() || "", tp1: e.tp1?.toString() || "", tp2: e.tp2?.toString() || "", pnl: Math.abs(e.pnl || 0).toString() });
    setEditIdx(idx); setShowForm(true);
  };

  const handleDelete = async (idx) => {
    const updated = journal.filter((_, i) => i !== idx);
    setJournal(updated); await saveJ(updated);
  };

  const IS = { background: "#070b0f", border: "1px solid #1c2631", color: "#c9d1d9", padding: "7px 10px", borderRadius: 5, fontFamily: "inherit", fontSize: 12, width: "100%", outline: "none" };
  const LS = { fontSize: 9, color: "#4a5568", marginBottom: 4, letterSpacing: "0.1em" };
  const displayText = loading ? stream : plan;

  return (
    <div style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", color: "#c9d1d9", padding: 0, margin: 0, background: "#07090c", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700&family=Syne:wght@700;800;900&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#00e5ff22;border-radius:2px}
        select option{background:#0d1117!important}
        textarea{resize:vertical}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        .pulse{animation:blink 1.8s ease-in-out infinite}
      `}</style>

      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 14px" }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#00e5ff66", marginBottom: 4 }}>◉ BYBIT PERPETUAL · NATHAN'S SCALP DESK</div>
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 900, color: "#e6edf3", margin: 0, letterSpacing: "-0.02em" }}>
              SCALP <span style={{ color: "#00e5ff" }}>COMMAND</span> CENTER
            </h1>
            <div style={{ fontSize: 10, color: "#2d3748", marginTop: 2 }}>Min 8/10 · RR ≥ 1:2 · On-chain › Struktur › Indikator</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { l: "WIN RATE", v: winRate ? `${winRate}%` : "—", c: winRate && parseInt(winRate) >= 55 ? "#3fb950" : "#f0883e" },
              { l: "TOTAL PnL", v: `${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toFixed(1)}`, c: totalPnl >= 0 ? "#3fb950" : "#f85149" },
              { l: "TRADES", v: journal.length, c: "#dde4ec" },
            ].map(s => (
              <div key={s.l} style={{ background: "#0a0e13", border: "1px solid #1c2631", borderRadius: 7, padding: "8px 12px", textAlign: "center", minWidth: 66 }}>
                <div style={{ fontSize: 8, color: "#4a5568", letterSpacing: "0.1em", marginBottom: 3 }}>{s.l}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#0d1117", border: "1px solid #1c2631", borderRadius: 8, padding: "8px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 8, color: "#2d3748", marginBottom: 4, letterSpacing: "0.12em" }}>MARKET PRICES · {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
          <Ticker coins={COINS} />
        </div>

        <div style={{ background: "#0a0b08", border: "1px solid #f0883e18", borderRadius: 7, padding: "7px 12px", marginBottom: 10, fontSize: 10, color: "#f0883e66" }}>
          ◈ {MACRO_TEXT}
        </div>

        {lossStreak && (
          <div style={{ background: "#160404", border: "1px solid #f85149", borderRadius: 7, padding: "8px 14px", marginBottom: 10, fontSize: 11, color: "#f85149", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            🛑 2 LOSS BERTURUT-TURUT TERDETEKSI — STOP TRADING HARI INI. Evaluasi ulang besok.
          </div>
        )}

        <div style={{ background: "#0d1117", border: "1px solid #1c2631", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10, alignItems: "end" }}>
            {[
              { label: "MODAL (USDT)", el: <input style={IS} type="number" value={capital} onChange={e => setCapital(e.target.value)} /> },
              {
                label: "RISK %", el: <select style={IS} value={risk} onChange={e => setRisk(e.target.value)}>
                  <option value="0.5">0.5% Konservatif</option><option value="1">1% Moderat</option><option value="2">2% Agresif</option>
                </select>
              },
              { label: "LEVERAGE", el: <input style={IS} type="number" min="1" max="20" value={leverage} onChange={e => setLeverage(e.target.value)} /> },
              {
                label: "TIMEFRAME", el: <select style={IS} value={timeframe} onChange={e => setTimeframe(e.target.value)}>
                  {["1m", "3m", "5m", "15m"].map(t => <option key={t}>{t}</option>)}
                </select>
              },
              {
                label: "SESI", el: <select style={IS} value={session} onChange={e => setSession(e.target.value)}>
                  {["Asia", "London", "New York", "Overlap"].map(s => <option key={s}>{s}</option>)}
                </select>
              },
            ].map(({ label, el }) => (
              <div key={label}><div style={LS}>{label}</div>{el}</div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 11, color: "#4a5568" }}>
              Risk per trade: <span style={{ color: "#f0883e", fontWeight: 700 }}>${riskUsdt} USDT</span>
              {losses.length > 0 && <span style={{ marginLeft: 12, color: "#f85149", fontSize: 10 }}>⚠ {losses.length} loss di journal → AI analisis</span>}
            </div>
            <button onClick={generatePlan} disabled={loading} style={{ padding: "9px 20px", borderRadius: 6, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", background: "#00e5ff18", border: "1px solid #00e5ff66", color: "#00e5ff", opacity: loading ? 0.6 : 1, letterSpacing: "0.04em" }}>
              {loading ? <span className="pulse">◌ AI ANALYZING...</span> : "▶ GET TODAY'S PLAN"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid #131a22" }}>
          {[
            { id: "plan", label: `TRADING PLAN${plan ? " ●" : ""}` },
            { id: "journal", label: `JOURNAL (${journal.length})` },
            { id: "market", label: "MARKET DATA" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 16px", fontFamily: "inherit", fontSize: 10, cursor: "pointer", background: "transparent", border: "none", letterSpacing: "0.08em", color: tab === t.id ? "#00e5ff" : "#4a5568", borderBottom: `2px solid ${tab === t.id ? "#00e5ff" : "transparent"}`, transition: "all 0.15s" }}>{t.label}</button>
          ))}
        </div>

        {tab === "plan" && (
          <div style={{ background: "#0d1117", border: "1px solid #131a22", borderTop: "none", borderRadius: "0 0 8px 8px", padding: 20, minHeight: 300 }}>
            {!displayText && !loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 260, gap: 10, color: "#1a2530" }}>
                <div style={{ fontSize: 28 }}>⬡</div>
                <div style={{ fontSize: 10, letterSpacing: "0.15em" }}>KLIK "GET TODAY'S PLAN" UNTUK MULAI</div>
                <div style={{ fontSize: 9, color: "#131a22" }}>AI analisis {COINS.length} pair · Multi-TF · On-chain · Elliott Wave · Conflict Resolution</div>
              </div>
            )}
            {displayText && (
              <>
                {planTime && !loading && (
                  <div style={{ fontSize: 9, color: "#2d3748", marginBottom: 14, letterSpacing: "0.08em" }}>
                    GENERATED {planTime} WIB · MIN 8/10 · RR ≥ 1:2 · MAX 3 SETUP
                  </div>
                )}
                {loading
                  ? <div style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#6a7585", lineHeight: "1.7" }}>{displayText}</div>
                  : <PlanRenderer text={displayText} addedPairs={addedPairs} onAdd={handleAddFromPlan} />
                }
                {plan && !loading && (
                  <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid #131a22", display: "flex", gap: 8 }}>
                    <button onClick={() => navigator.clipboard.writeText(plan)} style={{ padding: "7px 14px", borderRadius: 5, fontFamily: "inherit", fontSize: 10, cursor: "pointer", background: "transparent", border: "1px solid #1c2631", color: "#4a5568" }}>⎘ Copy Plan</button>
                    <button onClick={() => { setFormPrefill(null); setEditIdx(null); setShowForm(true); setTab("journal"); }} style={{ padding: "7px 14px", borderRadius: 5, fontFamily: "inherit", fontSize: 10, cursor: "pointer", background: "transparent", border: "1px solid #1c2631", color: "#4a5568" }}>+ Log Manual</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "journal" && (
          <div style={{ background: "#0d1117", border: "1px solid #131a22", borderTop: "none", borderRadius: "0 0 8px 8px", padding: 16, minHeight: 300 }}>
            {!showForm && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button onClick={() => { setFormPrefill(null); setEditIdx(null); setShowForm(true); }} style={{ padding: "7px 14px", borderRadius: 5, fontFamily: "inherit", fontSize: 10, fontWeight: 700, cursor: "pointer", background: "#00e5ff10", border: "1px solid #00e5ff44", color: "#00e5ff" }}>+ LOG TRADE</button>
              </div>
            )}
            {showForm && (
              <JournalForm
                key={editIdx !== null ? `edit-${editIdx}` : formPrefill ? `pre-${formPrefill.pair}` : "new"}
                prefill={formPrefill}
                editIdx={editIdx}
                onSave={handleSave}
                onCancel={() => { setShowForm(false); setEditIdx(null); setFormPrefill(null); }}
                timeframe={timeframe}
              />
            )}
            {journal.length === 0 && !showForm && (
              <div style={{ textAlign: "center", color: "#1c2631", padding: "48px 0", fontSize: 11 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>◎</div>
                Belum ada trade di journal.
              </div>
            )}
            {journal.map((entry, idx) => (
              <JournalCard key={idx} entry={entry} idx={idx} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {tab === "market" && (
          <div style={{ background: "#0d1117", border: "1px solid #131a22", borderTop: "none", borderRadius: "0 0 8px 8px", padding: 16 }}>
            <div style={{ fontSize: 9, color: "#4a5568", marginBottom: 12, letterSpacing: "0.12em" }}>MARKET SNAPSHOT · BYBIT PERPETUAL</div>
            <div style={{ overflowX: "auto", marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr>{["PAIR", "PRICE", "24H", "VOLUME", "OI TREND", "FUNDING", "SENTIMENT"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 9, color: "#4a5568", letterSpacing: "0.1em", borderBottom: "1px solid #131a22" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {COINS.map(c => {
                    const fNum = parseFloat(c.funding);
                    const fc = fNum > 0.01 ? "#f85149" : fNum < 0 ? "#3fb950" : "#556070";
                    const sc = c.sentiment === "Bullish" ? "#3fb950" : c.sentiment === "Bearish" ? "#f85149" : "#f0883e";
                    return (
                      <tr key={c.symbol} style={{ borderBottom: "1px solid #0e1318" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 700, color: "#dde4ec" }}>{c.pair}</td>
                        <td style={{ padding: "8px 10px", color: "#c9d1d9" }}>${fp(c.price)}</td>
                        <td style={{ padding: "8px 10px", color: c.change24h >= 0 ? "#3fb950" : "#f85149", fontWeight: 700 }}>{c.change24h >= 0 ? "+" : ""}{c.change24h}%</td>
                        <td style={{ padding: "8px 10px", color: "#556070" }}>{c.vol}</td>
                        <td style={{ padding: "8px 10px", color: c.oi === "Rising" ? "#3fb950" : c.oi === "Down" ? "#f85149" : "#556070" }}>{c.oi}</td>
                        <td style={{ padding: "8px 10px", color: fc, fontWeight: 600 }}>{c.funding}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 3, fontSize: 10, background: `${sc}18`, border: `1px solid ${sc}44`, color: sc }}>{c.sentiment}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "#0a0e13", border: "1px solid #131a22", borderRadius: 7, padding: 12 }}>
                <div style={{ fontSize: 9, color: "#00e5ff66", marginBottom: 8, letterSpacing: "0.1em" }}>CONFLICT RESOLUTION HIERARCHY</div>
                {["1. On-chain (BTC.D, OI, Funding) — TERTINGGI", "2. Market Structure (BOS/CHOCH, H4 trend)", "3. Technical Indicators (RSI, MACD, dll)", "→ Konflik tidak resolve = NO TRADE"].map((t, i) => (
                  <div key={i} style={{ fontSize: 11, color: i === 3 ? "#f85149" : "#556070", padding: "3px 0", lineHeight: "1.6" }}>{t}</div>
                ))}
              </div>
              <div style={{ background: "#0a0e13", border: "1px solid #131a22", borderRadius: 7, padding: 12 }}>
                <div style={{ fontSize: 9, color: "#f8514966", marginBottom: 8, letterSpacing: "0.1em" }}>NO TRADE CONDITIONS</div>
                {["Tidak ada BOS/CHOCH jelas", "Tidak ada liquidity sweep", "Market choppy/sideways", "High impact news aktif", "Konflik indikator tidak bisa resolve"].map((t, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#4a4050", padding: "3px 0", display: "flex", gap: 6, lineHeight: "1.6" }}>
                    <span style={{ color: "#5a2020" }}>✘</span>{t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
