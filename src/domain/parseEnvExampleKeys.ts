/** Variable names from .env.example-style files (lines like KEY=value or export KEY=value). */
export function parseEnvExampleKeys(content: string): string[] {
  const keys = new Set<string>();
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    let name = t.slice(0, eq).trim();
    if (name.startsWith("export ")) {
      name = name.slice(7).trim();
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      keys.add(name);
    }
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b));
}
