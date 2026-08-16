import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AccountingService } from './accounting.service';
import { AdminAccountingController } from './admin-accounting.controller';

@Module({
  imports: [MailModule],
  controllers: [AdminAccountingController],
  providers: [AccountingService],
  exports: [AccountingService],
})
export class AccountingModule {}
