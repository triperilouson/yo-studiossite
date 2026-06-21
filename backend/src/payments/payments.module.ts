import { Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './contracts/payment-provider';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { UnconfiguredPaymentProvider } from './unconfigured-payment.provider';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    UnconfiguredPaymentProvider,
    { provide: PAYMENT_PROVIDER, useExisting: UnconfiguredPaymentProvider },
  ],
})
export class PaymentsModule {}

