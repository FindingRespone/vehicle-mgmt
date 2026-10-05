export function csvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',');
}

export function formatDateOnly(value: Date | string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}
