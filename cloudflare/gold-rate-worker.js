const SOURCE_URL = "https://www.goodreturns.in/gold-rates/chennai.html";
const KEY = "chennai";

function parseRates(html) {
  const rates = {};
  for (const purity of ["18K", "22K", "24K"]) {
    const pattern = new RegExp(`id=["']${purity}-price["'][^>]*>[\\s\\S]{0,120}?(?:₹|&#x20b9;|&#8377;|&rupee;)\\s*([\\d,]+(?:\\.\\d+)?)`, "i");
    const match = html.match(pattern);
    const value = match ? Number(match[1].replace(/,/g, "")) : 0;
    if (!(value >= 1000 && value <= 100000)) throw new Error(`Invalid ${purity} rate`);
    rates[purity] = value;
  }
  return rates;
}

async function readRates(env) {
  const response = await fetch(SOURCE_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`GoodReturns returned ${response.status}`);
  const rates = parseRates(await response.text());
  const previous = await env.GOLD_RATES.get(KEY, "json");
  const updatedAt = new Date().toISOString();
  const rateDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(updatedAt));
  const previousDayRates = previous?.rateDate && previous.rateDate !== rateDate
    ? (previous.rates || {})
    : (previous?.previousDayRates || {});
  const record = { location: "Chennai", source: SOURCE_URL, rates, previousDayRates, rateDate, updatedAt };
  await env.GOLD_RATES.put(KEY, JSON.stringify(record));
  return record;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/rates") return new Response("Not found", { status: 404 });
    const record = await env.GOLD_RATES.get(KEY, "json");
    return new Response(JSON.stringify(record || { location: "Chennai", rates: {}, updatedAt: "" }), {
      headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "no-store" },
    });
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(readRates(env));
  },
};
