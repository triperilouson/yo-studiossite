import { createHash } from 'node:crypto';

type ReceiptPdfInput = {
  documentNumber: number;
  issuedAt: Date;
  customerName: string;
  customerEmail: string | null;
  payerAddress: string | null;
  businessName: string;
  businessTaxId: string;
  businessAddress: string;
  amountMinor: number;
  currency: string;
  description: string;
  paymentMethod: string;
  paymentReference: string | null;
  source: string;
  electronicDocumentLabel: string | null;
  documentHash: string;
  lineItems?: ReceiptPdfLineItem[];
  shippingMinor?: number;
};

export type ReceiptPdfLineItem = {
  title: string;
  size: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
};

export function receiptDocumentPayload(input: ReceiptPdfInput) {
  return {
    documentNumber: input.documentNumber,
    issuedAt: input.issuedAt.toISOString(),
    customerName: input.customerName,
    customerEmail: input.customerEmail || null,
    payerAddress: input.payerAddress || null,
    businessName: input.businessName,
    businessTaxId: input.businessTaxId,
    businessAddress: input.businessAddress,
    amountMinor: input.amountMinor,
    currency: input.currency,
    description: input.description,
    paymentMethod: input.paymentMethod,
    paymentReference: input.paymentReference || null,
    source: input.source,
    electronicDocumentLabel: input.electronicDocumentLabel || null,
    lineItems: input.lineItems?.map((item) => ({
      title: item.title,
      size: item.size,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      totalMinor: item.totalMinor,
    })) || [],
    shippingMinor: input.shippingMinor || 0,
  };
}

export function hashReceiptPayload(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function buildReceiptPdf(input: ReceiptPdfInput) {
  const issuedAt = input.issuedAt.toISOString();
  const amount = money(input.amountMinor, input.currency);
  const label = input.electronicDocumentLabel || 'Computerized document';
  const itemRows = orderItemRows(input);
  const content = [
    rect(0, 0, 595, 842, '0.045 0.045 0.045'),
    rect(42, 628, 511, 150, '0.96 0.95 0.92'),
    rect(42, 748, 511, 30, '0.08 0.08 0.08'),
    rect(42, 567, 511, 1, '0.78 0.78 0.74'),
    rect(42, 126, 511, 1, '0.78 0.78 0.74'),
    text(input.businessName, 54, 757, 13, '1 1 1'),
    text('RECEIPT', 54, 706, 34, '0.08 0.08 0.08'),
    text('KABALA - OSEK PATUR', 55, 684, 11, '0.28 0.28 0.28'),
    text('NO VAT CHARGED', 55, 666, 10, '0.28 0.28 0.28'),
    text(`No. ${input.documentNumber}`, 392, 706, 22, '0.08 0.08 0.08'),
    text(`Issued ${issuedAt}`, 392, 682, 9, '0.32 0.32 0.32'),
    text(label.toUpperCase(), 392, 666, 9, '0.32 0.32 0.32'),
    text('BUSINESS', 54, 594, 9, '0.72 0.72 0.68'),
    text(fit(input.businessName, 44), 54, 575, 13, '0.95 0.95 0.92'),
    text(`Business ID: ${input.businessTaxId}`, 54, 555, 10, '0.72 0.72 0.68'),
    ...wrappedText(input.businessAddress, 54, 538, 10, 62, 13, '0.72 0.72 0.68'),
    text('CUSTOMER', 318, 594, 9, '0.72 0.72 0.68'),
    text(fit(input.customerName, 34), 318, 575, 13, '0.95 0.95 0.92'),
    text(`Email: ${fit(input.customerEmail || '-', 42)}`, 318, 555, 10, '0.72 0.72 0.68'),
    ...wrappedText(input.payerAddress || '-', 318, 538, 10, 38, 13, '0.72 0.72 0.68'),
    rect(42, 377, 511, 112, '0.96 0.95 0.92'),
    text('PAYMENT DETAILS', 54, 462, 9, '0.32 0.32 0.32'),
    text('Amount received', 54, 435, 12, '0.22 0.22 0.22'),
    text(amount, 374, 429, 26, '0.08 0.08 0.08'),
    text(`Method: ${input.paymentMethod}`, 54, 407, 10, '0.32 0.32 0.32'),
    text(`Reference: ${fit(input.paymentReference || '-', 54)}`, 54, 390, 10, '0.32 0.32 0.32'),
    text('DESCRIPTION', 54, 335, 9, '0.72 0.72 0.68'),
    ...wrappedText(input.description, 54, 315, 10, 82, 13, '0.95 0.95 0.92', 2),
    ...itemRows,
    text(`Source: ${input.source}`, 54, 163, 9, '0.72 0.72 0.68'),
    text(`Document hash: ${fit(input.documentHash, 70)}`, 54, 146, 7, '0.55 0.55 0.52'),
    text('This is a computerized receipt generated after payment confirmation.', 54, 102, 9, '0.72 0.72 0.68'),
    text('Keep this document for your records. Amounts are shown without VAT for Osek Patur.', 54, 87, 9, '0.72 0.72 0.68'),
  ].join('\n');
  const stream = Buffer.from(content, 'utf8');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${content}\nendstream`,
  ];
  const chunks: string[] = ['%PDF-1.4\n'];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(chunks.join(''), 'utf8'));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });
  const xrefOffset = Buffer.byteLength(chunks.join(''), 'utf8');
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push('0000000000 65535 f \n');
  offsets.slice(1).forEach((offset) => chunks.push(`${offset.toString().padStart(10, '0')} 00000 n \n`));
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.from(chunks.join(''), 'utf8');
}

function money(amountMinor: number, currency: string) {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`;
}

function orderItemRows(input: ReceiptPdfInput) {
  const rows: string[] = [text('ORDER ITEMS', 54, 277, 9, '0.72 0.72 0.68')];
  if (!input.lineItems?.length) {
    rows.push(text('-', 54, 258, 10, '0.95 0.95 0.92'));
    return rows;
  }
  rows.push(text('Item', 54, 258, 8, '0.55 0.55 0.52'));
  rows.push(text('Qty', 331, 258, 8, '0.55 0.55 0.52'));
  rows.push(text('Unit', 385, 258, 8, '0.55 0.55 0.52'));
  rows.push(text('Total', 475, 258, 8, '0.55 0.55 0.52'));
  input.lineItems.slice(0, 5).forEach((item, index) => {
    const y = 239 - (index * 18);
    const itemName = `${item.title}${item.size ? ` / ${item.size}` : ''}`;
    rows.push(text(fit(itemName, 42), 54, y, 9, '0.95 0.95 0.92'));
    rows.push(text(String(item.quantity), 331, y, 9, '0.95 0.95 0.92'));
    rows.push(text(money(item.unitPriceMinor, input.currency), 385, y, 9, '0.95 0.95 0.92'));
    rows.push(text(money(item.totalMinor, input.currency), 475, y, 9, '0.95 0.95 0.92'));
  });
  const footerY = 239 - (Math.min(input.lineItems.length, 5) * 18);
  if (input.lineItems.length > 5) rows.push(text(`+ ${input.lineItems.length - 5} more line(s) in order snapshot`, 54, footerY, 8, '0.72 0.72 0.68'));
  if (input.shippingMinor) rows.push(text(`Shipping: ${money(input.shippingMinor, input.currency)}`, 385, 177, 8, '0.72 0.72 0.68'));
  return rows;
}

function rect(x: number, y: number, width: number, height: number, rgb: string) {
  return `q ${rgb} rg ${x} ${y} ${width} ${height} re f Q`;
}

function text(value: string, x: number, y: number, size: number, rgb: string) {
  return [
    'BT',
    `${rgb} rg`,
    `/F1 ${size} Tf`,
    `${x} ${y} Td`,
    `(${pdfEscape(value)}) Tj`,
    'ET',
  ].join('\n');
}

function wrappedText(value: string, x: number, y: number, size: number, maxChars: number, lineHeight: number, rgb: string, maxLines = 4) {
  return wrap(value, maxChars).slice(0, maxLines).map((line, index) => text(line, x, y - (index * lineHeight), size, rgb));
}

function wrap(value: string, maxChars: number) {
  const words = value.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}

function fit(value: string, maxChars: number) {
  return value.length > maxChars ? `${value.slice(0, Math.max(0, maxChars - 3))}...` : value;
}

function pdfEscape(value: string) {
  return value.replace(/[^\x20-\x7E]/g, '').replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}
