// SPDX-FileCopyrightText: 2026 Kaede Akino
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SITE, UA } from "./constants.js";

// Kept here as well, so a refactor of the constants module never takes this
// file with it.
const FALLBACK_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const FALLBACK_SITE = "https://music.163.com";

const FORMATS = ["mp3", "flac", "ogg", "wav", "m4a", "aac"];

// A self-hosted unlock service answers with a bare audio URL for a NetEase id.
// The two that share this code answer differently: UnblockNeteaseMusic-utils
// gives {data:{url}}, api-enhanced gives {data:"url", proxyUrl}.
export async function unblockedStream(id: string) {
  if (host.setting("unblock") !== "true") return null;
  const base = (host.setting("unblockApi") || "").trim().replace(/\/+$/, "");
  if (!base) return null;
  const route = host.setting("unblockServer") === "utils" ? "/match" : "/song/url/match";
  try {
    // A stopped service must cost one request, not a stalled track.
    const deadline = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
    const response = await Promise.race([
      fetch(`${base}${route}?id=${encodeURIComponent(id)}`, {}),
      deadline,
    ]);
    if (!response?.ok) return null;
    const body = (await response.json()) as { data?: unknown; proxyUrl?: string };
    const raw =
      typeof body.data === "string"
        ? body.proxyUrl || body.data
        : (body.data as { url?: string } | undefined)?.url;
    if (typeof raw !== "string" || !/^https?:\/\//.test(raw)) return null;
    const extension = new URL(raw).pathname.split(".").pop()?.toLowerCase() ?? "";
    const type = FORMATS.includes(extension) ? extension : "mp3";
    return {
      // Both services answer with http://; the audio CDN serves https too.
      url: raw.replace(/^http:/, "https:"),
      type,
      quality: type === "flac" ? "lossless" : "high",
      bitRate: 0,
      size: 0,
      gain: 0,
      peak: 0,
      headers: { "User-Agent": UA || FALLBACK_UA, Referer: `${SITE || FALLBACK_SITE}/` },
    };
  } catch {
    return null;
  }
}
