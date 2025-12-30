/**
 * 📘 quantAnalyzer.ts
 * ARKON-JANUS v3.6.3 (2025 기준)
 *
 * 기능:
 * 1️⃣ 주가 시계열(OHLCV)에서 단기 추세 분석
 * 2️⃣ 외국인/기관 수급 흐름으로 강세/약세 감지
 * 3️⃣ 이동평균, 거래량, RSI 기반 신호 계산
 * 4️⃣ 결과를 “GO / CAUTION / NO-GO”로 판단
 */

export type QuantResult = {
  asof: string;
  price_signal: "GO" | "CAUTION" | "NO-GO";
  trend: string;
  rsi?: number | null;
  ma5?: number | null;
  ma20?: number | null;
  turnover_rate?: number | null;
  volume_surge?: boolean;
  commentary: string;
};

/**
 * 단순 이동평균 계산
 */
function sma(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * RSI 계산 (14일 기본)
 */
function calcRSI(close: number[], period = 14): number | null {
  if (close.length < period + 1) return null;

  const diffs = [];
  for (let i = 1; i < close.length; i++) {
    diffs.push(close[i] - close[i - 1]);
  }

  const gains = diffs.map((d) => (d > 0 ? d : 0));
  const losses = diffs.map((d) => (d < 0 ? Math.abs(d) : 0));

  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * 거래량 급증 여부 판단
 */
function detectVolumeSurge(volumes: number[]): boolean {
  if (volumes.length < 10) return false;
  const last = volumes[volumes.length - 1];
  const avg = sma(volumes, 10);
  return avg ? last > avg * 2 : false;
}

/**
 * 주가 및 수급 기반 신호 분석
 */
export async function analyzeQuant(
  priceSeries: {
    date: string;
    close: number;
    volume?: number;
    foreign_net?: number;
    inst_net?: number;
  }[]
): Promise<QuantResult> {
  if (!priceSeries || priceSeries.length < 20) {
    return {
      asof: new Date().toISOString(),
      price_signal: "NO-GO",
      trend: "데이터 부족",
      commentary: "시계열 데이터가 부족합니다.",
    };
  }

  const closes = priceSeries.map((p) => p.close);
  const volumes = priceSeries.map((p) => p.volume ?? 0);
  const lastClose = closes[closes.length - 1];
  const prevClose = closes[closes.length - 2];

  const ma5 = sma(closes, 5);
  const ma20 = sma(closes, 20);
  const rsi = calcRSI(closes, 14);
  const volume_surge = detectVolumeSurge(volumes);

  // 수급 데이터 (직전 5일 합산)
  const foreignSum = priceSeries
    .slice(-5)
    .reduce((a, b) => a + (b.foreign_net ?? 0), 0);
  const instSum = priceSeries
    .slice(-5)
    .reduce((a, b) => a + (b.inst_net ?? 0), 0);

  // 추세 판단
  let trend = "횡보";
  if (ma5 && ma20 && ma5 > ma20) trend = "상승";
  else if (ma5 && ma20 && ma5 < ma20) trend = "하락";

  // 기본 시그널 판단
  let signal: QuantResult["price_signal"] = "CAUTION";
  if (trend === "상승" && rsi && rsi < 70 && foreignSum > 0 && instSum > 0)
    signal = "GO";
  else if (trend === "하락" && (rsi ?? 50) > 70)
    signal = "NO-GO";

  // 코멘트 생성
  const commentary = [
    `추세: ${trend}`,
    `RSI: ${rsi ? rsi.toFixed(1) : "N/A"}`,
    `MA5: ${ma5?.toFixed(1) ?? "N/A"} / MA20: ${ma20?.toFixed(1) ?? "N/A"}`,
    `외국인 5D 순매수: ${foreignSum.toFixed(0)}`,
    `기관 5D 순매수: ${instSum.toFixed(0)}`,
    volume_surge ? "거래량 급증 감지 ⚠️" : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    asof: new Date().toISOString(),
    price_signal: signal,
    trend,
    rsi,
    ma5,
    ma20,
    turnover_rate: null, // 향후 추가 가능
    volume_surge,
    commentary,
  };
}
