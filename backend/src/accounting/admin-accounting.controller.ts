import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { AccountingService } from './accounting.service';
import { CancelReceiptDto, CreateReceiptDto, ReceiptQueryDto, SendReceiptDto } from './dto/accounting.dto';

@ApiTags('admin-accounting')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/accounting')
export class AdminAccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Get('receipts')
  list(@Query() query: ReceiptQueryDto) {
    return this.accounting.list(query);
  }

  @Get('summary')
  summary(@Query() query: ReceiptQueryDto) {
    return this.accounting.summary(query);
  }

  @Get('reports.csv')
  async csv(@Query() query: ReceiptQueryDto, @Res() reply: FastifyReply) {
    const receipts = await this.accounting.list({ ...query, take: 200, skip: 0 });
    const rows = [
      ['NUMBER', 'DATE', 'CUSTOMER', 'EMAIL', 'AMOUNT_MINOR', 'CURRENCY', 'SOURCE', 'STATUS', 'PAYMENT_METHOD'],
      ...receipts.map((receipt) => [
        String(receipt.documentNumber),
        receipt.issuedAt.toISOString(),
        receipt.customerName,
        receipt.customerEmail || '',
        String(receipt.amountMinor),
        receipt.currency,
        receipt.source,
        receipt.status,
        receipt.paymentMethod,
      ]),
    ];
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="yo-receipts.csv"')
      .send(rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n'));
  }

  @Post('receipts')
  create(@CurrentUser() actor: AuthUser, @Body() input: CreateReceiptDto) {
    return this.accounting.createManual(actor.userId, input);
  }

  @Get('receipts/:id/pdf')
  async pdf(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() reply: FastifyReply) {
    const { receipt, buffer } = await this.accounting.pdf(id, actor.userId);
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="yo-receipt-${receipt.documentNumber}.pdf"`)
      .send(buffer);
  }

  @Post('receipts/:id/send')
  send(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() input: SendReceiptDto) {
    return this.accounting.send(actor.userId, id, input);
  }

  @Patch('receipts/:id/cancel')
  cancel(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() input: CancelReceiptDto) {
    return this.accounting.cancel(actor.userId, id, input);
  }

  @Get('receipts/:id/events')
  events(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounting.events(id);
  }
}
