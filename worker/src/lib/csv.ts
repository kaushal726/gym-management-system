/** CSV with every cell quoted, and a BOM so Excel opens Indian names correctly. Cells starting with
 * = + - @ tab or return (other than plain numbers) are prefixed with ' so a spreadsheet never runs them as formulas. */
export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const cell = (value: string) => {
    const formulaLike = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value);
    const safe = formulaLike ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
