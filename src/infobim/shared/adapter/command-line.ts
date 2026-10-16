/**
 * Splits a command line into its words. Single or double quotes group words
 * that contain spaces; there is no other shell syntax (no pipes, variables or escapes).
 */
export function splitCommandLine(command: string): string[] {
  const words: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let started = false;

  for (const char of command) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started || current) words.push(current);
      current = '';
      started = false;
    } else {
      current += char;
    }
  }
  if (quote) throw new Error('The command has an unclosed quote.');
  if (started || current) words.push(current);
  return words;
}
