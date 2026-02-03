import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Bill, BillStatus } from '../entities/billing.entity';
import { PaymentGatewayConfig, PaymentProviderType } from '../entities/payment-gateway-config.entity';

@Injectable()
export class PaymentsService {
  
  async processMobileMoneyPayment(paymentData: any, tenantDb: DataSource) {
    const { billId, amount, phoneNumber, provider, currency = 'USD' } = paymentData;
    
    const billRepo = tenantDb.getRepository(Bill);
    const bill = await billRepo.findOne({ where: { id: billId } });
    
    if (!bill) {
      throw new Error('Bill not found');
    }

    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Route to appropriate mobile money provider
    let result;
    switch (provider.toLowerCase()) {
      case 'ecocash':
        result = await this.processEcoCashPayment({ billId, amount, phoneNumber, currency }, tenantDb);
        break;
      case 'onemoney':
        result = await this.processOneMoneyPayment({ billId, amount, phoneNumber, currency }, tenantDb);
        break;
      default:
        throw new Error('Unsupported payment provider');
    }

    return result;
  }

  async processEcoCashPayment(paymentData: any, tenantDb: DataSource) {
    const { billId, amount, phoneNumber, currency = 'USD' } = paymentData;
    
    // Fetch tenant-specific configuration
    let merchantId = 'SIMULATED_MERCHANT';
    try {
      const configRepo = tenantDb.getRepository(PaymentGatewayConfig);
      const config = await configRepo.findOne({
        where: { providerType: PaymentProviderType.ECOCASH, isActive: true }
      });
      if (config && config.merchantId) {
        merchantId = config.merchantId;
      }
    } catch (e) {
      console.warn('Failed to load EcoCash config', e);
    }

    const transactionId = `ECO_${Date.now()}`;
    
    // Simulate EcoCash API integration
    const ecocashResponse = {
      transactionId,
      status: 'PENDING',
      provider: 'EcoCash',
      merchantId, // Return the tenant-specific merchant ID
      amount,
      currency,
      phoneNumber,
      reference: `REF_${transactionId}`,
      instructions: `Dial *151# and follow prompts to pay $${amount} to MediCore Clinic`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
      fees: this.calculateEcoCashFees(amount),
      timestamp: new Date().toISOString()
    };

    // Update bill status
    const billRepo = tenantDb.getRepository(Bill);
    await billRepo.update(billId, {
      status: BillStatus.PENDING,
    });

    return ecocashResponse;
  }

  async processOneMoneyPayment(paymentData: any, tenantDb: DataSource) {
    const { billId, amount, phoneNumber, currency = 'USD' } = paymentData;
    
    // Fetch tenant-specific configuration
    let merchantId = 'SIMULATED_MERCHANT';
    try {
      const configRepo = tenantDb.getRepository(PaymentGatewayConfig);
      const config = await configRepo.findOne({
        where: { providerType: PaymentProviderType.ONEMONEY, isActive: true }
      });
      if (config && config.merchantId) {
        merchantId = config.merchantId;
      }
    } catch (e) {
      console.warn('Failed to load OneMoney config', e);
    }

    const transactionId = `ONE_${Date.now()}`;
    
    // Simulate OneMoney API integration
    const onemoneyResponse = {
      transactionId,
      status: 'PENDING',
      provider: 'OneMoney',
      merchantId, // Return the tenant-specific merchant ID
      amount,
      currency,
      phoneNumber,
      reference: `REF_${transactionId}`,
      instructions: `You will receive an SMS prompt to authorize payment of $${amount} to MediCore Clinic`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      fees: this.calculateOneMoneyFees(amount),
      timestamp: new Date().toISOString()
    };

    // Update bill status
    const billRepo = tenantDb.getRepository(Bill);
    await billRepo.update(billId, {
      status: BillStatus.PENDING,
    });

    return onemoneyResponse;
  }

  async getPaymentStatus(transactionId: string, tenantDb: DataSource) {
    // Simulate payment status check
    const statuses = ['PENDING', 'COMPLETED', 'FAILED', 'EXPIRED'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    const provider = transactionId.startsWith('ECO_') ? 'EcoCash' : 
                    transactionId.startsWith('ONE_') ? 'OneMoney' : 'Unknown';

    return {
      transactionId,
      status: randomStatus,
      provider,
      completedAt: randomStatus === 'COMPLETED' ? new Date().toISOString() : null,
      failureReason: randomStatus === 'FAILED' ? 'Insufficient funds' : null,
      reference: `REF_${transactionId}`,
      amount: 50.00,
      currency: 'USD'
    };
  }

  async verifyPayment(transactionId: string, reference: string, tenantDb: DataSource) {
    // Simulate payment verification with mobile money provider
    const isValid = Math.random() > 0.1; // 90% success rate
    
    if (isValid) {
      // Update bill as paid
      const billRepo = tenantDb.getRepository(Bill);
      // In real implementation, find bill by transaction reference
      
      return {
        verified: true,
        transactionId,
        reference,
        status: 'VERIFIED',
        amount: 50.00,
        currency: 'USD',
        verifiedAt: new Date().toISOString()
      };
    } else {
      return {
        verified: false,
        transactionId,
        reference,
        status: 'VERIFICATION_FAILED',
        reason: 'Transaction not found or invalid'
      };
    }
  }

  async getPaymentMethods() {
    return {
      mobileMoney: [
        {
          provider: 'EcoCash',
          name: 'EcoCash',
          logo: '/images/ecocash-logo.png',
          supported: true,
          currencies: ['USD', 'ZWL'],
          fees: {
            percentage: 2.5,
            minimum: 0.10,
            maximum: 5.00
          },
          limits: {
            minimum: 1.00,
            maximum: 1000.00,
            daily: 5000.00
          }
        },
        {
          provider: 'OneMoney',
          name: 'OneMoney',
          logo: '/images/onemoney-logo.png',
          supported: true,
          currencies: ['USD', 'ZWL'],
          fees: {
            percentage: 2.0,
            minimum: 0.05,
            maximum: 3.00
          },
          limits: {
            minimum: 1.00,
            maximum: 500.00,
            daily: 2000.00
          }
        }
      ],
      traditional: [
        {
          method: 'cash',
          name: 'Cash Payment',
          supported: true,
          currencies: ['USD', 'ZWL']
        },
        {
          method: 'bank_transfer',
          name: 'Bank Transfer',
          supported: true,
          currencies: ['USD', 'ZWL']
        }
      ]
    };
  }

  private calculateEcoCashFees(amount: number): number {
    // EcoCash fee structure (simplified)
    const percentage = 0.025; // 2.5%
    const fee = amount * percentage;
    return Math.max(0.10, Math.min(fee, 5.00)); // Min $0.10, Max $5.00
  }

  private calculateOneMoneyFees(amount: number): number {
    // OneMoney fee structure (simplified)
    const percentage = 0.02; // 2.0%
    const fee = amount * percentage;
    return Math.max(0.05, Math.min(fee, 3.00)); // Min $0.05, Max $3.00
  }
}