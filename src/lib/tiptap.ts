/** Build a minimal TipTap document JSON string from plain text (one paragraph per line). */
export function textToTiptapJson(text: string): string {
  const lines = text.split(/\r?\n/);
  const content = lines.map((line) =>
    line
      ? { type: "paragraph", content: [{ type: "text", text: line }] }
      : { type: "paragraph" },
  );
  return JSON.stringify({
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  });
}
