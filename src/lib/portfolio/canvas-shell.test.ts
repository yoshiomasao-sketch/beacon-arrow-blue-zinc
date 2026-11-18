import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { desktopRailOpen, dockedSlideshowKeyAction } from "./canvas-shell.ts";

describe("canvas shell", () => {
  it("keeps the desktop rails where they were while a viewer is open", () => {
    assert.equal(desktopRailOpen(true, true, false), true);
    assert.equal(desktopRailOpen(true, false, true), false);
    assert.equal(desktopRailOpen(false, false, true), true);
    assert.equal(desktopRailOpen(false, true, false), false);
  });

  it("lets the menu and canvas keep keys while a docked slideshow plays", () => {
    assert.equal(dockedSlideshowKeyAction("menu", "Escape"), "pass");
    assert.equal(dockedSlideshowKeyAction("menu", "Enter"), "pass");
    assert.equal(dockedSlideshowKeyAction("canvas", "ArrowLeft"), "pass");
    assert.equal(dockedSlideshowKeyAction("other", "Escape"), "pass");
    assert.equal(dockedSlideshowKeyAction("page", "Escape"), "close");
    assert.equal(dockedSlideshowKeyAction("page", " "), "pass");
    assert.equal(dockedSlideshowKeyAction("viewer", "Escape"), "close");
    assert.equal(dockedSlideshowKeyAction("viewer", "ArrowRight"), "swallow");
  });
});
