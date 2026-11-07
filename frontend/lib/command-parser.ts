/**
 * Parses the command bar's quick-add syntax:
 *
 *   cordless drill @garage #tools #power ×2 $89.99
 *
 * - text before the first token is the item name
 * - `@place`   where it lives (may contain spaces: `@living room`)
 * - `#tag`     a tag, repeatable (may contain spaces: `#home assistant`)
 * - `×2`, `x2`, `*2`  quantity
 * - `$89.99`   purchase price
 *
 * A token starts at the beginning of the input or after whitespace and runs
 * until the next token, so `@` or `#` inside a word (an email, "C#") stays text.
 */
export type ParsedCommand = {
  name: string;
  place?: string;
  tags: string[];
  quantity?: number;
  price?: number;
};

const TOKEN = /(^|\s)(@|#|\$|×|\*|x(?=\d))/g;

export function parseCommand(input: string): ParsedCommand {
  const result: ParsedCommand = { name: "", tags: [] };
  const marks: { kind: string; start: number; contentStart: number }[] = [];

  for (const m of input.matchAll(TOKEN)) {
    const start = m.index! + m[1]!.length;
    marks.push({ kind: m[2]!, start, contentStart: start + m[2]!.length });
  }

  result.name = (marks.length ? input.slice(0, marks[0]!.start) : input).trim();

  marks.forEach((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1]!.start : input.length;
    const value = input.slice(mark.contentStart, end).trim();
    if (!value) return;

    switch (mark.kind) {
      case "@":
        result.place = value;
        break;
      case "#":
        if (!result.tags.includes(value)) result.tags.push(value);
        break;
      case "$": {
        const price = Number.parseFloat(value.replace(",", "."));
        if (Number.isFinite(price) && price >= 0) result.price = price;
        break;
      }
      default: {
        const qty = Number.parseInt(value, 10);
        if (Number.isFinite(qty) && qty > 0) result.quantity = qty;
      }
    }
  });

  return result;
}

/** True when the input uses any quick-add token, i.e. the user is describing a new item. */
export function hasCommandTokens(input: string): boolean {
  return new RegExp(TOKEN.source).test(input);
}
