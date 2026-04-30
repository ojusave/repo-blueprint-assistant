/** First EXPOSE port in Dockerfile content (Render still injects process.env.PORT at runtime). */
export function parseDockerfileExpose(content: string): number | undefined {
  for (const line of content.split("\n")) {
    const t = line.trim().replace(/#.*/, "").trim();
    const m = /^EXPOSE\s+(\d{1,5})(?:\/\w+)?\s*$/i.exec(t);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 65535) return n;
    }
  }
  return undefined;
}
