import { createHash } from 'node:crypto';
import { join } from 'node:path';

const PDFDocument = require('pdfkit');

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

export type ReceiptPdfLanguage = 'en' | 'he';
export type ReceiptPdfLineItem = {
  title: string;
  size: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
};

type PdfDoc = {
  registerFont(name: string, path: string): PdfDoc;
  font(name: string): PdfDoc;
  fontSize(size: number): PdfDoc;
  fillColor(color: string): PdfDoc;
  rect(x: number, y: number, width: number, height: number): PdfDoc;
  fill(color?: string): PdfDoc;
  moveTo(x: number, y: number): PdfDoc;
  lineTo(x: number, y: number): PdfDoc;
  strokeColor(color: string): PdfDoc;
  lineWidth(width: number): PdfDoc;
  stroke(): PdfDoc;
  text(text: string, x?: number, y?: number, options?: Record<string, unknown>): PdfDoc;
  on(event: 'data', callback: (chunk: Buffer) => void): PdfDoc;
  on(event: 'end', callback: () => void): PdfDoc;
  end(): void;
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

export function buildReceiptPdf(input: ReceiptPdfInput, language: ReceiptPdfLanguage = 'en'): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Receipt ${input.documentNumber}` } }) as PdfDoc;
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const fontPath = join(__dirname, 'assets', 'NotoSansHebrew-Regular.ttf');
    doc.registerFont('receipt', fontPath).font('receipt');
    drawReceipt(doc, input, language);
    doc.end();
  });
}

function drawReceipt(doc: PdfDoc, input: ReceiptPdfInput, language: ReceiptPdfLanguage) {
  const brand = input.businessName || 'יוו';
  const isHe = language === 'he';
  background(doc);
  header(doc, input, brand, isHe);
  parties(doc, input, brand, isHe);
  payment(doc, input, isHe);
  items(doc, input, isHe);
  footer(doc, input, isHe);
}

function background(doc: PdfDoc) {
  doc.rect(0, 0, 595, 842).fill('#0b0b0b');
  doc.rect(42, 64, 511, 150).fill('#f2f0ea');
  doc.rect(42, 64, 511, 30).fill('#151515');
  rule(doc, 42, 281, 511);
  rule(doc, 42, 716, 511);
}

function header(doc: PdfDoc, input: ReceiptPdfInput, brand: string, isHe: boolean) {
  const issuedAt = input.issuedAt.toISOString();
  const label = input.electronicDocumentLabel || 'Computerized document';
  text(doc, brand, 54, 73, 13, '#ffffff');
  if (isHe) {
    text(doc, 'קבלה', 372, 112, 34, '#151515', { width: 165, align: 'right' });
    text(doc, 'עוסק פטור', 372, 153, 12, '#4a4a4a', { width: 165, align: 'right' });
    text(doc, 'לא כולל מע"מ - עוסק פטור', 316, 173, 10, '#4a4a4a', { width: 221, align: 'right' });
    text(doc, 'מסמך מקור בעברית', 372, 193, 9, '#5a5a5a', { width: 165, align: 'right' });
    text(doc, `No. ${input.documentNumber}`, 54, 112, 22, '#151515');
    text(doc, `Issued ${issuedAt}`, 54, 152, 9, '#4a4a4a');
    text(doc, label.toUpperCase(), 54, 172, 9, '#4a4a4a');
  } else {
    text(doc, 'RECEIPT', 54, 112, 34, '#151515');
    text(doc, 'KABALA - OSEK PATUR', 55, 153, 11, '#4a4a4a');
    text(doc, 'NO VAT CHARGED', 55, 173, 10, '#4a4a4a');
    text(doc, 'ENGLISH COPY / TRANSLATION', 55, 193, 9, '#5a5a5a');
    text(doc, `No. ${input.documentNumber}`, 392, 112, 22, '#151515');
    text(doc, `Issued ${issuedAt}`, 392, 152, 9, '#4a4a4a');
    text(doc, label.toUpperCase(), 392, 172, 9, '#4a4a4a');
  }
}

function parties(doc: PdfDoc, input: ReceiptPdfInput, brand: string, isHe: boolean) {
  if (isHe) {
    label(doc, 'פרטי העסק', 54, 248, 222, 'right');
    text(doc, brand, 54, 268, 13, '#f2f0ea', { width: 222, align: 'right' });
    text(doc, `מספר עוסק: ${input.businessTaxId}`, 54, 294, 10, '#b8b8b2', { width: 222, align: 'right' });
    text(doc, input.businessAddress, 54, 315, 10, '#b8b8b2', { width: 222, align: 'right' });
    label(doc, 'לקוח', 318, 248, 222, 'right');
    text(doc, input.customerName, 318, 268, 13, '#f2f0ea', { width: 222, align: 'right' });
    text(doc, `Email: ${input.customerEmail || '-'}`, 318, 294, 10, '#b8b8b2', { width: 222 });
    text(doc, input.payerAddress || '-', 318, 315, 10, '#b8b8b2', { width: 222, align: 'right' });
    return;
  }
  label(doc, 'BUSINESS', 54, 248);
  text(doc, brand, 54, 268, 13, '#f2f0ea', { width: 222 });
  text(doc, `Business ID: ${input.businessTaxId}`, 54, 294, 10, '#b8b8b2', { width: 222 });
  text(doc, input.businessAddress, 54, 315, 10, '#b8b8b2', { width: 222 });
  label(doc, 'CUSTOMER', 318, 248);
  text(doc, input.customerName, 318, 268, 13, '#f2f0ea', { width: 222 });
  text(doc, `Email: ${input.customerEmail || '-'}`, 318, 294, 10, '#b8b8b2', { width: 222 });
  text(doc, input.payerAddress || '-', 318, 315, 10, '#b8b8b2', { width: 222 });
}

function payment(doc: PdfDoc, input: ReceiptPdfInput, isHe: boolean) {
  doc.rect(42, 375, 511, 112).fill('#f2f0ea');
  const amount = money(input.amountMinor, input.currency);
  if (isHe) {
    text(doc, 'פרטי תשלום', 54, 397, 9, '#4a4a4a', { width: 486, align: 'right' });
    text(doc, 'סכום שהתקבל', 54, 426, 12, '#303030', { width: 486, align: 'right' });
    text(doc, amount, 54, 421, 26, '#151515');
    text(doc, `אמצעי תשלום: ${input.paymentMethod}`, 54, 456, 10, '#4a4a4a', { width: 486, align: 'right' });
    text(doc, `אסמכתא: ${input.paymentReference || '-'}`, 54, 474, 10, '#4a4a4a', { width: 486, align: 'right' });
    label(doc, 'תיאור', 54, 526, 486, 'right');
    text(doc, input.description, 54, 548, 10, '#f2f0ea', { width: 486, align: 'right' });
    return;
  }
  text(doc, 'PAYMENT DETAILS', 54, 397, 9, '#4a4a4a');
  text(doc, 'Amount received', 54, 426, 12, '#303030');
  text(doc, amount, 374, 421, 26, '#151515', { width: 166, align: 'right' });
  text(doc, `Method: ${input.paymentMethod}`, 54, 456, 10, '#4a4a4a');
  text(doc, `Reference: ${input.paymentReference || '-'}`, 54, 474, 10, '#4a4a4a');
  label(doc, 'DESCRIPTION', 54, 526);
  text(doc, input.description, 54, 548, 10, '#f2f0ea', { width: 486 });
}

function items(doc: PdfDoc, input: ReceiptPdfInput, isHe: boolean) {
  const rows = input.lineItems?.slice(0, 5) || [];
  if (isHe) {
    label(doc, 'פריטים', 54, 604, 486, 'right');
    text(doc, 'פריט', 54, 628, 8, '#8a8a84', { width: 240, align: 'right' });
    text(doc, 'כמות', 304, 628, 8, '#8a8a84', { width: 45, align: 'right' });
    text(doc, 'Unit', 374, 628, 8, '#8a8a84');
    text(doc, 'Total', 470, 628, 8, '#8a8a84');
    rows.forEach((item, index) => {
      const y = 650 + (index * 18);
      const name = `${item.title}${item.size ? ` / ${item.size}` : ''}`;
      text(doc, name, 54, y, 9, '#f2f0ea', { width: 240, align: 'right' });
      text(doc, String(item.quantity), 304, y, 9, '#f2f0ea', { width: 45, align: 'right' });
      text(doc, money(item.unitPriceMinor, input.currency), 374, y, 9, '#f2f0ea');
      text(doc, money(item.totalMinor, input.currency), 470, y, 9, '#f2f0ea');
    });
    if (input.shippingMinor) text(doc, `משלוח: ${money(input.shippingMinor, input.currency)}`, 54, 747, 8, '#b8b8b2', { width: 486, align: 'right' });
    return;
  }
  label(doc, 'ORDER ITEMS', 54, 604);
  text(doc, 'Item', 54, 628, 8, '#8a8a84');
  text(doc, 'Qty', 331, 628, 8, '#8a8a84');
  text(doc, 'Unit', 385, 628, 8, '#8a8a84');
  text(doc, 'Total', 475, 628, 8, '#8a8a84');
  rows.forEach((item, index) => {
    const y = 650 + (index * 18);
    const name = `${item.title}${item.size ? ` / ${item.size}` : ''}`;
    text(doc, name, 54, y, 9, '#f2f0ea', { width: 260 });
    text(doc, String(item.quantity), 331, y, 9, '#f2f0ea');
    text(doc, money(item.unitPriceMinor, input.currency), 385, y, 9, '#f2f0ea');
    text(doc, money(item.totalMinor, input.currency), 475, y, 9, '#f2f0ea');
  });
  if (input.shippingMinor) text(doc, `Shipping: ${money(input.shippingMinor, input.currency)}`, 385, 747, 8, '#b8b8b2');
}

function footer(doc: PdfDoc, input: ReceiptPdfInput, isHe: boolean) {
  if (isHe) {
    text(doc, `מקור: ${input.source}`, 54, 726, 9, '#b8b8b2', { width: 486, align: 'right' });
    text(doc, `Document hash: ${shortHash(input.documentHash)}`, 54, 745, 7, '#8a8a84');
    text(doc, 'מסמך ממוחשב שנוצר לאחר אישור התשלום.', 54, 753, 9, '#b8b8b2', { width: 486, align: 'right' });
    text(doc, 'הסכומים מוצגים ללא מע"מ עבור עוסק פטור.', 54, 771, 9, '#b8b8b2', { width: 486, align: 'right' });
    return;
  }
  text(doc, `Source: ${input.source}`, 54, 726, 9, '#b8b8b2');
  text(doc, `Document hash: ${shortHash(input.documentHash)}`, 54, 745, 7, '#8a8a84');
  text(doc, 'This is a computerized receipt generated after payment confirmation.', 54, 753, 9, '#b8b8b2');
  text(doc, 'Keep this document for your records. Amounts are shown without VAT for Osek Patur.', 54, 771, 9, '#b8b8b2');
}

function text(doc: PdfDoc, value: string, x: number, y: number, size: number, color: string, options: Record<string, unknown> = {}) {
  doc.font('receipt').fontSize(size).fillColor(color).text(value, x, y, options);
}

function label(doc: PdfDoc, value: string, x: number, y: number, width = 222, align: 'left' | 'right' = 'left') {
  text(doc, value, x, y, 9, '#b8b8b2', { width, align });
}

function rule(doc: PdfDoc, x: number, y: number, width: number) {
  doc.moveTo(x, y).lineTo(x + width, y).strokeColor('#c8c7c1').lineWidth(1).stroke();
}

function money(amountMinor: number, currency: string) {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`;
}

function shortHash(value: string) {
  return value.length > 70 ? `${value.slice(0, 70)}...` : value;
}
