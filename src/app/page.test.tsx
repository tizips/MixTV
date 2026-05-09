import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the homepage content", async () => {
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain("MixTV");
  });
});
