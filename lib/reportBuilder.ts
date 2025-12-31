// app/lib/reportBuilder.ts
export function buildFullReport(
  valuation: any,
  risk: any,
  quant: any,
  summary: any
) {
  const now = new Date().toISOString().slice(0, 10);

  return `
✅ **ARKON-JANUS 통합 리포트**  
**기준일:** ${now}  

---

### 1️⃣ FUNDAMENTAL (재무 요약)
- PER: ${valuation?.per ?? "N/A"}
- PBR: ${valuation?.pbr ?? "N/A"}
- ROE: ${valuation?.roe ?? "N/A"}
- 영업이익률(OPM): ${valuation?.opm ?? "N/A"}
- FCF Yield: ${valuation?.fcf_yield ?? "N/A"}
> 📊 평가: ${valuation?.score ?? "N/A"} / 10  
> 🗓️ 기준: ${valuation?.asof ?? ""}

---

### 2️⃣ RISK (재무 안정성)
- 부채비율: ${
    typeof risk?.debt_ratio === "number" ? risk.debt_ratio.toFixed(1) : "N/A"
  }%
- 유동비율: ${
    typeof risk?.current_ratio === "number" ? risk.current_ratio.toFixed(1) : "N/A"
  }%
- 자본비율: ${
    typeof risk?.equity_ratio === "number" ? risk.equity_ratio.toFixed(1) : "N/A"
  }%
> ⚠️ 상태: ${risk?.alert ?? "N/A"}  
> 💬 코멘트: ${risk?.commentary ?? ""}

---

### 3️⃣ QUANT (시계열 분석)
- 시그널: ${quant?.price_signal ?? "N/A"}
- 트렌드: ${quant?.trend ?? "N/A"}
> 💬 ${quant?.commentary ?? ""}

---

### 4️⃣ SUMMARY
- 종합 평점: ${summary?.valuation_score ?? "N/A"}
- 리스크 레벨: ${summary?.risk_level ?? "N/A"}
- 매매 신호: ${summary?.signal ?? "N/A"}

---

📘 **자동 생성 시스템:** ARKON-JANUS v3.6.3  
🕒 Generated at: ${new Date().toLocaleString()}
`;
}
