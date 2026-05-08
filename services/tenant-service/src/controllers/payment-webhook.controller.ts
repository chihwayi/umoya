import { Controller, Post, Req, Res, Logger, RawBodyRequest, Headers } from '@nestjs/common';
import { Request, Response } from 'express';
import { PaymentService } from '../payment/payment.service';

@Controller('payment-webhook')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('verif-hash') flwSig: string,
    @Headers('x-zimswitch-signature') zimsig: string,
    @Headers('stripe-signature') stripeSig: string,
    @Headers('x-goog-signature') mpesaSig: string,
  ): Promise<void> {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    const signature = flwSig ?? zimsig ?? stripeSig ?? mpesaSig ?? '';

    try {
      await this.paymentService.handleWebhook(rawBody, signature);
    } catch (err: any) {
      this.logger.error(`Webhook processing error: ${err.message}`);
    }

    // Always return 200 to the provider so it does not retry
    res.status(200).json({ received: true });
  }
}
