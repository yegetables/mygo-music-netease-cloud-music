// SPDX-FileCopyrightText: 2026 Kaede Akino
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import test from "node:test";
import { harness, type Call } from "./harness.ts";

// NetEase answers a song it will not stream in full with a preview, or with no
// URL at all.
const preview = () => ({
  data: [{ id: 1, url: "", freeTrialInfo: { start: 0, end: 30 } }],
});

const settings = (over: Record<string, string> = {}) => ({
  unblock: "true",
  unblockApi: "https://unlock.test",
  ...over,
});

test("the toggle off asks no unlock service", async () => {
  const h = await harness(preview);
  await assert.rejects(h.plugin.stream({ id: "1" }), { code: "unavailable" });
  assert.equal(h.calls.length, 1);
});

test("an api-enhanced deployment answers with the URL it matched", async () => {
  const h = await harness(
    ({ path }) => (path === "/song/url/match" ? { data: "http://cdn.example/a.flac" } : preview()),
    { settings: settings() },
  );
  const result = await h.plugin.stream({ id: "1" });
  assert.equal(result.url, "https://cdn.example/a.flac");
  assert.equal(result.type, "flac");
});

test("a UnblockNeteaseMusic-utils deployment answers with data.url", async () => {
  const h = await harness(
    ({ path }) => (path === "/match" ? { data: { url: "http://cdn.example/a.mp3" } } : preview()),
    { settings: settings({ unblockServer: "utils" }) },
  );
  const result = await h.plugin.stream({ id: "1" });
  assert.equal(result.url, "https://cdn.example/a.mp3");
  assert.equal(result.type, "mp3");
});

test("an unlock service that does not answer leaves the song unavailable", async () => {
  const h = await harness(
    ({ path }) => {
      if (path === "/song/url/match") throw new Error("connect ECONNREFUSED");
      return preview();
    },
    { settings: settings() },
  );
  await assert.rejects(h.plugin.stream({ id: "1" }), { code: "unavailable" });
});

test("the unlock request carries no session cookie", async () => {
  const asked: Call[] = [];
  const h = await harness(
    (call) => {
      if (call.path !== "/song/url/match") return preview();
      asked.push(call);
      return { data: "https://cdn.example/a.mp3" };
    },
    { settings: settings(), signedIn: true },
  );
  await h.plugin.stream({ id: "1" });
  assert.equal(asked.length, 1);
  assert.equal(Object.hasOwn(asked[0].options, "headers"), false);
});
