/**
 * quantAnalyzer.ts
 * - 가격 시계열로 ATR, RSI 등 기본 퀀트 신호 계산
 */

export function analyzeQuant(priceSeries: { close: number; high: number; low: number; volume: number }[]) {
  if (!priceSeries || priceSeries.length < 15) return { signal: "LOCK", reason: "Insufficient data" };

  const closes = priceSeries.map(p => p.close);
  const highs = priceSeries.map(p => p.high);
  const lows = priceSeries.map(p => p.low);

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  // ATR(14)
  const trs = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    trs.push(tr);
  }
  const atr = avg(trs.slice(-14));

  // RSI(14)
  const gains = [];
  const losses = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains.push(diff);
    else losses.push(Math.abs(diff));
  }
  const avgGain = avg(gains.slice(-14));
  const avgLoss = avg(losses.slice(-14));
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  // 단순 시그널 판단
  let signal = "NEUTRAL";
  if (rsi > 70) signal = "OVERBOUGHT";
  if (rsi < 30) signal = "OVERSOLD";

  return { ATR: atr, RSI: rsi, signal };
}
