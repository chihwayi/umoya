import { Injectable } from '@nestjs/common';
import { IPaymentGateway } from './payment-gateway.interface';
import { FlutterwaveProvider } from './providers/flutterwave.provider';
import { MpesaProvider } from './providers/mpesa.provider';
import { ZimSwitchProvider } from './providers/zimswitch.provider';
import { StripeProvider } from './providers/stripe.provider';

@Injectable()
export class PaymentGatewayFactory {
  constructor(
    private readonly flutterwave: FlutterwaveProvider,
    private readonly mpesa: MpesaProvider,
    private readonly zimswitch: ZimSwitchProvider,
    private readonly stripe: StripeProvider,
  ) {}

  getProvider(): IPaymentGateway | null {
    const provider = (process.env.PAYMENT_PROVIDER ?? '').toLowerCase();
    switch (provider) {
      case 'flutterwave': return this.flutterwave;
      case 'mpesa': return this.mpesa;
      case 'zimswitch': return this.zimswitch;
      case 'stripe': return this.stripe;
      default: return null;
    }
  }
}
