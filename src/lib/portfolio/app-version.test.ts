import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APP_UPDATED_LABEL, APP_VERSION, versionFromStamp } from "./app-version.ts";

describe("app version", () => {
  it("builds Ver.YYMMDDHHMM and the Japanese time from the same JST stamp", () => {
    assert.deepEqual(versionFromStamp("2026-11-08T13:10:00+09:00"), {
      code: "Ver.2611081310",
      label: "2026年11月8日 13時10分",
    });
    assert.deepEqual(versionFromStamp("2026-11-09T09:30:00+09:00"), {
      code: "Ver.2611090930",
      label: "2026年11月9日 09時30分",
    });
    assert.deepEqual(versionFromStamp("2026-12-01T18:45:00+09:00"), {
      code: "Ver.2612011845",
      label: "2026年12月1日 18時45分",
    });
  });

  it("shows the current release in 詳細", () => {
    assert.equal(APP_VERSION, "Ver.2611112205");
    assert.equal(APP_UPDATED_LABEL, "2026年11月11日 22時05分");
  });
});
