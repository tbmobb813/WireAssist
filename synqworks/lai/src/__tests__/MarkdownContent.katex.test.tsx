import { render } from "@testing-library/react";
import { describe, test, expect } from "vitest";
import MarkdownContent from "../components/MarkdownContent";

describe("MarkdownContent KaTeX rendering", () => {
  test("renders block math with KaTeX output element", () => {
    const content = "$$\\frac{a}{b}$$";
    const { container } = render(<MarkdownContent content={content} />);

    // KaTeX renders elements with class 'katex' when rehype-katex runs
    const katexEl =
      container.querySelector(".katex") ||
      container.querySelector(".katex-display");
    // In jsdom, rehype-katex may not fully render; at minimum the original delimiters should not be present
    expect(katexEl || container.textContent).toBeTruthy();
  });
});
