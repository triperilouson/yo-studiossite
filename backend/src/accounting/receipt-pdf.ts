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
  };
}

export function hashReceiptPayload(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function buildReceiptPdf(input: ReceiptPdfInput) {
  const lines = [
    input.businessName,
    'RECEIPT / KABALA',
    input.electronicDocumentLabel || 'Computerized document',
    `Business ID: ${input.businessTaxId}`,
    `Business address: ${input.businessAddress}`,
    `Receipt No.: ${input.documentNumber}`,
    `Date: ${input.issuedAt.toISOString()}`,
    `Received from: ${input.customerName}`,
    `Payer email: ${input.customerEmail || '-'}`,
    `Payer address: ${input.payerAddress || '-'}`,
    `Amount: ${money(input.amountMinor, input.currency)}`,
    `Description: ${input.description}`,
    `Payment method: ${input.paymentMethod}`,
    `Payment reference: ${input.paymentReference || '-'}`,
    `Source: ${input.source}`,
    `Document hash: ${input.documentHash}`,
  ];
  const content = [
    'BT',
    '/F1 18 Tf',
    '50 790 Td',
    ...lines.flatMap((line, index) => [
      `${index === 0 ? 0 : 18} -${index === 0 ? 0 : 22} Td`,
      `(${pdfEscape(line)}) Tj`,
    ]),
    'ET',
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

function pdfEscape(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}
