import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HomepageShell } from "./homepage-shell";
import { getHomepageData } from "../application/homepage-service";

describe("HomepageShell", () => {
  it("renders the welcome banner and homepage sections", async () => {
    const data = await getHomepageData();
    const html = renderToStaticMarkup(<HomepageShell data={data} />);

    expect(html).toContain("MixTV");
    expect(html).toContain("欢迎");
  });
});
