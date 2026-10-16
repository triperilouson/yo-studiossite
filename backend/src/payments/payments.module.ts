import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER } from './contracts/payment-provider';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { UnconfiguredPaymentProvider } from './unconfigured-payment.provider';
import { HypPaymentProvider } from './hyp-payment.provider';
import { MailModule } from '../mail/mail.module';
import { AccountingModule } from '../accounting/accounting.module';
import type { Environment } from '../config/env';

@Module({
  imports: [MailModule, AccountingModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    UnconfiguredPaymentProvider,
    HypPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, HypPaymentProvider, UnconfiguredPaymentProvider],
      useFactory: (
        config: ConfigService<Environment, true>,
        hyp: HypPaymentProvider,
        unconfigured: UnconfiguredPaymentProvider,
      ) => (config.get('PAYMENT_PROVIDER', { infer: true }) === 'hyp' ? hyp : unconfigured),
    },
  ],
})
export class PaymentsModule {}
