import { describe, expect, it, vi } from 'vitest';
import { AccountingService } from '../../src/accounting/accounting.service';
import { MailService } from '../../src/mail/mail.service';

describe('receipt email language', () => {
  it.each([false, true])('sends English and includes Hebrew only when enabled: %s', async (enabled) => {
    const item = { titleSnapshot: 'Original shirt', sizeSnapshot: 'M', quantity: 2, unitPriceMinor: 12000, productIdSnapshot: 'product' };
    const receipt = { customerEmail: 'buyer@example.com', order: { items: [item] } };
    const db = {
      storeSettings: { upsert: vi.fn().mockResolvedValue({ hebrewReceiptsEnabled: enabled }) },
      productImage: { findMany: vi.fn().mockResolvedValue([{ productId: 'product', url: '/shirt.jpg' }]) },
      receiptEvent: { create: vi.fn() },
    };
    const mail = { sendReceiptPdfs: vi.fn() };
    const service = new AccountingService(db as never, {} as never, mail as never, {} as never);
    const pdf = vi.spyOn(service, 'pdf').mockImplementation((_id, _actor, lang) => Promise.resolve({ receipt, buffer: Buffer.from(lang!) }) as never);
    await service.sendCustomerReceipt('receipt');
    expect(pdf.mock.calls.map((call) => call[2])).toEqual(enabled ? ['en', 'he'] : ['en']);
    expect(mail.sendReceiptPdfs).toHaveBeenCalledWith('buyer@example.com', receipt, {
      en: Buffer.from('en'), he: enabled ? Buffer.from('he') : undefined,
    }, [{ ...item, imageUrl: '/shirt.jpg' }]);
  });

  it('renders order snapshot prices and safe photo previews in English email', async () => {
    const service = new MailService({ get: () => 'https://shop.example.com' } as never);
    const send = vi.fn();
    Object.assign(service, { sendRaw: send });
    await service.sendReceiptPdfs('buyer@example.com', {
      documentNumber: 10, amountMinor: 24000, currency: 'ILS', issuedAt: new Date('2026-10-16T00:00:00Z'),
    } as never, { en: Buffer.from('pdf') }, [{
      titleSnapshot: 'Shirt <one>', sizeSnapshot: 'M', quantity: 2, unitPriceMinor: 12000, imageUrl: '/shirt.jpg',
    }]);
    const message = send.mock.calls[0][0];
    expect(message.attachments.map((attachment: { filename: string }) => attachment.filename)).toEqual(['yo-receipt-10-en.pdf']);
    expect(message.text).toContain('Your English receipt is attached.');
    expect(message.html).toContain('Shirt &lt;one&gt;');
    expect(message.html).toContain('https://shop.example.com/shirt.jpg');
    expect(message.text).toContain('120.00');
    expect(message.text).toContain('240.00');
  });
});
