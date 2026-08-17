import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { OrderFulfillmentStatus, OrderStatus, type Receipt } from '@prisma/client';
import type { Environment } from '../config/env';

type OrderMailItem = {
  titleSnapshot: string;
  sizeSnapshot: string;
  quantity: number;
  unitPriceMinor: number;
};

export type OrderMailSnapshot = {
  id: string;
  status: OrderStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  emailSnapshot: string;
  nameSnapshot: string;
  currency: string;
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  items: OrderMailItem[];
};

type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
  channel?: MailChannel;
};

type MailChannel = 'orders' | 'support' | 'marketing' | 'system';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private ses?: SESv2Client;

  constructor(private readonly config: ConfigService<Environment, true>) {}

  sendEmailVerification(to: string, token: string): Promise<void> {
    const link = this.frontendLink(`auth.html?verify=${encodeURIComponent(token)}`);
    return this.send({
      channel: 'system',
      to,
      subject: 'Verify your YO STUDIOS account',
      text: [
        'Verify your YO STUDIOS account.',
        '',
        `Open this link: ${link}`,
        '',
        'If you did not create this account, ignore this email.',
      ].join('\n'),
      html: this.layout('Verify your account', `
        <p>Welcome to YO STUDIOS.</p>
        <p>Confirm your email to secure your account.</p>
        <p><a href="${this.escape(link)}">Verify email</a></p>
        <p class="muted">If you did not create this account, ignore this email.</p>
      `),
    });
  }

  sendPasswordReset(to: string, token: string): Promise<void> {
    const link = this.frontendLink(`auth.html?reset=${encodeURIComponent(token)}`);
    return this.send({
      channel: 'system',
      to,
      subject: 'Reset your YO STUDIOS password',
      text: [
        'Reset your YO STUDIOS password.',
        '',
        `Open this link: ${link}`,
        '',
        'This link expires soon. If you did not request it, ignore this email.',
      ].join('\n'),
      html: this.layout('Reset your password', `
        <p>Use the link below to reset your password.</p>
        <p><a href="${this.escape(link)}">Reset password</a></p>
        <p class="muted">If you did not request this, ignore this email.</p>
      `),
    });
  }

  sendOrderCreated(order: OrderMailSnapshot): Promise<void> {
    return this.sendOrderMail(
      order,
      `YO STUDIOS order ${order.id.slice(0, 8)} created`,
      'Order created',
      'Your order was created and is waiting for payment confirmation.',
    );
  }

  sendPaymentReceipt(order: OrderMailSnapshot): Promise<void> {
    return this.sendOrderMail(
      order,
      `YO STUDIOS receipt ${order.id.slice(0, 8)}`,
      'Payment received',
      'Payment was confirmed by the payment provider. We will prepare your order next.',
    );
  }

  async sendReceiptPdf(to: string, receipt: Receipt, pdf: Buffer): Promise<void> {
    const subject = `YO STUDIOS receipt ${receipt.documentNumber}`;
    const text = [
      'YO STUDIOS receipt',
      '',
      `Document number: ${receipt.documentNumber}`,
      `Amount: ${this.money(receipt.amountMinor, receipt.currency)}`,
      `Issued at: ${receipt.issuedAt.toISOString()}`,
      '',
      'The PDF receipt is attached.',
    ].join('\n');
    const html = this.layout('Receipt issued', `
      <p>Your YO STUDIOS receipt is attached as a PDF.</p>
      <p class="muted">Document ${receipt.documentNumber}</p>
      <p><strong>${this.escape(this.money(receipt.amountMinor, receipt.currency))}</strong></p>
    `);
    await this.sendRaw({
      channel: 'orders',
      to,
      subject,
      text,
      html,
      attachments: [{
        filename: `yo-receipt-${receipt.documentNumber}.pdf`,
        contentType: 'application/pdf',
        content: pdf,
      }],
    });
  }

  sendOrderStatus(order: OrderMailSnapshot): Promise<void> {
    const messages: Partial<Record<OrderStatus, [string, string]>> = {
      [OrderStatus.SHIPPED]: ['Order shipped', 'Your YO STUDIOS order has been shipped.'],
      [OrderStatus.COMPLETED]: ['Order completed', 'Your YO STUDIOS order is marked as completed.'],
      [OrderStatus.DELIVERED]: ['Order delivered', 'Your YO STUDIOS order is marked as delivered.'],
      [OrderStatus.CANCELLED]: ['Order cancelled', 'Your YO STUDIOS order has been cancelled.'],
      [OrderStatus.REFUNDED]: ['Order refunded', 'Your YO STUDIOS order has been refunded.'],
      [OrderStatus.FAILED]: ['Payment failed', 'Payment failed or expired. No paid order was created.'],
    };
    const [title, body] = messages[order.status] ?? ['Order updated', `Order status: ${order.status}`];
    return this.sendOrderMail(order, `YO STUDIOS ${title.toLowerCase()} ${order.id.slice(0, 8)}`, title, body);
  }

  sendOrderFulfillmentStatus(order: OrderMailSnapshot): Promise<void> {
    const messages: Record<OrderFulfillmentStatus, [string, string]> = {
      [OrderFulfillmentStatus.REVIEWING]: ['Order under review', 'Your payment is confirmed. We are reviewing the order before fulfilment.'],
      [OrderFulfillmentStatus.ACCEPTED]: ['Order accepted', 'Your YO STUDIOS order has been accepted.'],
      [OrderFulfillmentStatus.READY_FOR_DELIVERY]: ['Order ready for delivery', 'Your order is packed and ready for pickup or delivery handoff.'],
      [OrderFulfillmentStatus.IN_TRANSIT]: ['Order in transit', 'Your YO STUDIOS order is on the way.'],
      [OrderFulfillmentStatus.DELIVERED]: ['Order delivered', 'Your YO STUDIOS order is marked as delivered.'],
      [OrderFulfillmentStatus.RECEIVED]: ['Order received', 'Your YO STUDIOS order is marked as received.'],
    };
    const [title, body] = messages[order.fulfillmentStatus];
    return this.sendOrderMail(order, `YO STUDIOS ${title.toLowerCase()} ${order.id.slice(0, 8)}`, title, body);
  }

  sendSupportReply(to: string, subject: string, body: string, messageId: string): Promise<void> {
    return this.sendRaw({
      channel: 'support',
      to,
      subject: `YO STUDIOS support: ${subject}`,
      headers: { 'Message-ID': messageId },
      text: [
        body,
        '',
        'YO STUDIOS support',
      ].join('\n'),
      html: this.layout('Support reply', `
        <p>${this.escape(body).replaceAll('\n', '<br>')}</p>
        <p class="muted">Reply to this email to continue the conversation.</p>
      `),
      attachments: [],
    });
  }

  private async sendOrderMail(order: OrderMailSnapshot, subject: string, title: string, body: string): Promise<void> {
    const rows = order.items.map((item) =>
      `${item.titleSnapshot} / ${item.sizeSnapshot} x ${item.quantity} - ${this.money(item.unitPriceMinor * item.quantity, order.currency)}`);
    await this.send({
      channel: 'orders',
      to: order.emailSnapshot,
      subject,
      text: [
        title,
        '',
        body,
        '',
        `Order: ${order.id}`,
        `Customer: ${order.nameSnapshot}`,
        '',
        ...rows,
        '',
        `Subtotal: ${this.money(order.subtotalMinor, order.currency)}`,
        `Shipping: ${this.money(order.shippingMinor, order.currency)}`,
        `Total: ${this.money(order.totalMinor, order.currency)}`,
      ].join('\n'),
      html: this.layout(title, `
        <p>${this.escape(body)}</p>
        <p class="muted">Order ${this.escape(order.id)}</p>
        <table>${order.items.map((item) => `
          <tr>
            <td>${this.escape(item.titleSnapshot)} / ${this.escape(item.sizeSnapshot)}</td>
            <td>x ${item.quantity}</td>
            <td>${this.escape(this.money(item.unitPriceMinor * item.quantity, order.currency))}</td>
          </tr>`).join('')}
          <tr><td>Subtotal</td><td></td><td>${this.escape(this.money(order.subtotalMinor, order.currency))}</td></tr>
          <tr><td>Shipping</td><td></td><td>${this.escape(this.money(order.shippingMinor, order.currency))}</td></tr>
          <tr><td><strong>Total</strong></td><td></td><td><strong>${this.escape(this.money(order.totalMinor, order.currency))}</strong></td></tr>
        </table>
      `),
    });
  }

  private async send(message: MailMessage): Promise<void> {
    try {
      if (this.config.get('MAIL_PROVIDER', { infer: true }) === 'console') {
        this.logger.log(`[console-mail] ${message.subject} -> ${message.to}\n${message.text}`);
        return;
      }
      const from = this.fromAddress(message.channel);
      const fromName = this.config.get('SES_FROM_NAME', { infer: true });
      const replyTo = this.replyToAddress(message.channel);
      const configurationSetName = this.config.get('SES_CONFIGURATION_SET', { infer: true });
      const client = this.getSesClient();
      await client.send(new SendEmailCommand({
        FromEmailAddress: `${fromName} <${from}>`,
        Destination: { ToAddresses: [message.to] },
        ReplyToAddresses: replyTo ? [replyTo] : undefined,
        ConfigurationSetName: configurationSetName || undefined,
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: 'UTF-8' },
            Body: {
              Text: { Data: message.text, Charset: 'UTF-8' },
              Html: { Data: message.html, Charset: 'UTF-8' },
            },
          },
        },
      }));
    } catch (error: unknown) {
      const strict = this.config.get('MAIL_STRICT_DELIVERY', { infer: true }) === 'true';
      const messageText = error instanceof Error ? error.message : 'Unknown mail delivery error';
      this.logger.error(`Mail delivery failed: ${messageText}`);
      if (strict) throw error;
    }
  }

  private async sendRaw(message: MailMessage & { attachments: Array<{ filename: string; contentType: string; content: Buffer }> }): Promise<void> {
    try {
      if (this.config.get('MAIL_PROVIDER', { infer: true }) === 'console') {
        this.logger.log(`[console-mail] ${message.subject} -> ${message.to}\n${message.text}\n[attachments] ${message.attachments.map((item) => item.filename).join(', ')}`);
        return;
      }
      const from = this.fromAddress(message.channel);
      const fromName = this.config.get('SES_FROM_NAME', { infer: true });
      const replyTo = this.replyToAddress(message.channel);
      const configurationSetName = this.config.get('SES_CONFIGURATION_SET', { infer: true });
      const boundary = `yo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const related = [
        `From: ${this.mimeHeader(fromName)} <${from}>`,
        `To: ${message.to}`,
        `Subject: ${this.mimeHeader(message.subject)}`,
        ...Object.entries(message.headers ?? {}).map(([key, value]) => `${key}: ${value}`),
        'MIME-Version: 1.0',
        replyTo ? `Reply-To: ${replyTo}` : '',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        message.text,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        message.html,
        '',
        ...message.attachments.flatMap((attachment) => [
          `--${boundary}`,
          `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          '',
          attachment.content.toString('base64').replace(/.{1,76}/g, '$&\r\n'),
          '',
        ]),
        `--${boundary}--`,
        '',
      ].filter(Boolean).join('\r\n');
      const client = this.getSesClient();
      await client.send(new SendEmailCommand({
        FromEmailAddress: `${fromName} <${from}>`,
        Destination: { ToAddresses: [message.to] },
        ReplyToAddresses: replyTo ? [replyTo] : undefined,
        ConfigurationSetName: configurationSetName || undefined,
        Content: { Raw: { Data: Buffer.from(related, 'utf8') } },
      }));
    } catch (error: unknown) {
      const strict = this.config.get('MAIL_STRICT_DELIVERY', { infer: true }) === 'true';
      const messageText = error instanceof Error ? error.message : 'Unknown mail delivery error';
      this.logger.error(`Mail delivery failed: ${messageText}`);
      if (strict) throw error;
    }
  }

  private getSesClient(): SESv2Client {
    if (!this.ses) {
      this.ses = new SESv2Client({ region: this.config.get('SES_REGION', { infer: true }) });
    }
    return this.ses;
  }

  private fromAddress(channel: MailChannel = 'system'): string {
    const fallback = this.config.get('SES_FROM_EMAIL', { infer: true });
    const keys: Record<MailChannel, 'SES_FROM_ORDERS' | 'SES_FROM_SUPPORT' | 'SES_FROM_MARKETING' | 'SES_FROM_SYSTEM'> = {
      orders: 'SES_FROM_ORDERS',
      support: 'SES_FROM_SUPPORT',
      marketing: 'SES_FROM_MARKETING',
      system: 'SES_FROM_SYSTEM',
    };
    return this.config.get(keys[channel], { infer: true }) || fallback || 'noreply@yo-studios.com';
  }

  private replyToAddress(channel: MailChannel = 'system'): string {
    if (channel === 'support') {
      return this.config.get('SES_FROM_SUPPORT', { infer: true }) || this.config.get('SES_REPLY_TO', { infer: true });
    }
    return this.config.get('SES_REPLY_TO', { infer: true });
  }

  private frontendLink(path: string): string {
    return `${this.config.get('FRONTEND_URL', { infer: true }).replace(/\/+$/, '')}/${path}`;
  }

  private money(minor: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);
  }

  private layout(title: string, content: string): string {
    return `<!doctype html><html><body style="margin:0;background:#070808;color:#f2f2ec;font-family:Arial,sans-serif">
      <main style="max-width:640px;margin:0 auto;padding:32px">
        <p style="letter-spacing:.28em;color:#a7ff3b;font-size:12px">YO STUDIOS</p>
        <h1 style="font-size:28px;line-height:1.1;margin:0 0 24px">${this.escape(title)}</h1>
        <section style="background:#101111;border:1px solid #272a27;padding:24px">${content}</section>
        <p style="color:#82887e;font-size:12px;margin-top:24px">Automated transactional email from YO STUDIOS.</p>
      </main>
      <style>
        a{color:#a7ff3b} table{width:100%;border-collapse:collapse;margin-top:16px}
        td{border-top:1px solid #272a27;padding:10px 0;font-size:14px}.muted{color:#82887e}
      </style>
    </body></html>`;
  }

  private escape(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  private mimeHeader(value: string): string {
    return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
  }
}
