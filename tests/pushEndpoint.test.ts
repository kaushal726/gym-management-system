import { describe, expect, it } from "vitest";
import { isPushServiceUrl } from "../worker/src/push/endpoint.ts";

describe("push endpoints", () => {
  it("accepts the browsers' push services", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isPushServiceUrl(url), url).toBe(true);
    }
  });

  it("refuses anything else", () => {
    for (const url of [
      "https://evil.example/x",
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com.evil.example/x",
      "https://evilfcm.googleapis.com/x",
      "https://fcm.googleapis.com@evil.example/x",
      "https://fcm.googleapis.com:8443/x",
      "https://notify.windows.com.evil.example/x",
      "not a url",
    ]) {
      expect(isPushServiceUrl(url), url).toBe(false);
    }
  });
});
