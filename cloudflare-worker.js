const SITE_ORIGIN = "https://chenyou951121-hue.github.io";
const EXCHANGE_CODES = ["tse_t00.tw", "tse_2330.tw", "tse_2317.tw", "tse_2454.tw"];

function responseHeaders(origin) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=30",
    Vary: "Origin",
  });

  if (origin === SITE_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", SITE_ORIGIN);
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Max-Age", "86400");
  }

  return headers;
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin");
    const headers = responseHeaders(origin);

    if (origin !== SITE_ORIGIN) {
      return jsonResponse({ error: "Origin not allowed" }, 403, origin);
    }

    if (request.method === "OPTIONS") {
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405, origin);
    }

    const query = new URLSearchParams({
      ex_ch: EXCHANGE_CODES.join("|"),
      json: "1",
      delay: "0",
    });
    const upstreamUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?${query}`;

    try {
      const upstream = await fetch(upstreamUrl, {
        cf: { cacheTtl: 30, cacheEverything: true },
      });

      if (!upstream.ok) {
        return jsonResponse({ error: "The exchange service is unavailable" }, 502, origin);
      }

      const result = await upstream.json();
      if (result.rtcode !== "0000") {
        return jsonResponse({ error: "The exchange did not return quote data" }, 502, origin);
      }

      const msgArray = (result.msgArray || []).map((item) => ({
        c: item.c,
        z: item.z,
        tv: item.tv,
        pz: item.pz,
        y: item.y,
        trade: item.trade ? { z: item.trade.z } : undefined,
      }));

      return jsonResponse(
        {
          msgArray,
          queryTime: { sysTime: result.queryTime?.sysTime || "" },
        },
        200,
        origin,
      );
    } catch (error) {
      console.error("Taiwan quote proxy failed.", error);
      return jsonResponse({ error: "Could not retrieve quotes" }, 502, origin);
    }
  },
};
