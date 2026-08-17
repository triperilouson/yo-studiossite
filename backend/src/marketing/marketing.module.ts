import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AdminMarketingController, MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';

@Module({
  imports: [MailModule],
  controllers: [MarketingController, AdminMarketingController],
  providers: [MarketingService],
})
export class MarketingModule {}
