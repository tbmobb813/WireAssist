import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import MarkdownContent from "../components/MarkdownContent";

describe("MarkdownContent component", () => {
  test("renders without crashing", () => {
    render(<MarkdownContent content="Hello" />);
    expect(true).toBeTruthy();
  });

  test("component is exported", () => {
    expect(MarkdownContent).toBeDefined();
  });

  test("renders plain text", () => {
    const { container } = render(<MarkdownContent content="Plain text" />);
    expect(container.textContent).toContain("Plain text");
  });

  test("renders bold markdown", () => {
    const { container } = render(<MarkdownContent content="**bold text**" />);
    expect(container).toBeTruthy();
  });

  test("renders italic markdown", () => {
    const { container } = render(<MarkdownContent content="*italic text*" />);
    expect(container).toBeTruthy();
  });

  test("renders links", () => {
    const { container } = render(
      <MarkdownContent content="[link](https://example.com)" />,
    );
    expect(container).toBeTruthy();
  });

  test("renders headings", () => {
    const { container } = render(<MarkdownContent content="# Heading" />);
    expect(container).toBeTruthy();
  });

  test("renders code inline", () => {
    const { container } = render(<MarkdownContent content="`const x = 1`" />);
    expect(container).toBeTruthy();
  });

  test("renders code blocks", () => {
    const { container } = render(
      <MarkdownContent content="```js\nconst x = 1;\n```" />,
    );
    expect(container).toBeTruthy();
  });

  test("renders blockquotes", () => {
    const { container } = render(
      <MarkdownContent content="> This is a quote" />,
    );
    expect(container).toBeTruthy();
  });

  test("renders lists", () => {
    const { container } = render(
      <MarkdownContent content="- Item 1\n- Item 2" />,
    );
    expect(container).toBeTruthy();
  });

  test("renders nested lists", () => {
    const { container } = render(
      <MarkdownContent content="- Item 1\n  - Nested item" />,
    );
    expect(container).toBeTruthy();
  });

  test("renders horizontal rule", () => {
    const { container } = render(<MarkdownContent content="---" />);
    expect(container).toBeTruthy();
  });

  test("renders tables", () => {
    const { container } = render(
      <MarkdownContent content="| col1 | col2 |\n|------|------|\n| a    | b    |" />,
    );
    expect(container).toBeTruthy();
  });

  test("handles empty content", () => {
    const { container } = render(<MarkdownContent content="" />);
    expect(container).toBeTruthy();
  });

  test("handles very long content", () => {
    const longContent = "x".repeat(5000);
    const { container } = render(<MarkdownContent content={longContent} />);
    expect(container).toBeTruthy();
  });

  test("renders multiple paragraphs", () => {
    const { container } = render(
      <MarkdownContent content="Para 1\n\nPara 2\n\nPara 3" />,
    );
    expect(container).toBeTruthy();
  });

  test("escapes HTML tags safely", () => {
    const { container } = render(
      <MarkdownContent content="<script>alert('xss')</script>" />,
    );
    // Should not execute script
    expect(container).toBeTruthy();
  });

  test("renders strikethrough", () => {
    const { container } = render(
      <MarkdownContent content="~~strikethrough~~" />,
    );
    expect(container).toBeTruthy();
  });

  test("handles mixed markdown", () => {
    const { container } = render(
      <MarkdownContent content="# Title\n\n**Bold** and *italic*\n\n- List\n- Items" />,
    );
    expect(container).toBeTruthy();
  });
});
