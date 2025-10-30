import { Controller, Post, Get, Put, Body, Param, Req, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { OrderService, CreateOrderDto, UpdateOrderDto } from '../services/order.service';
import { OrderType, OrderStatus } from '../entities/order.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async createOrder(@Body() body: CreateOrderDto, @Req() req: RequestWithTenant) {
    const tenantId = req.tenantId;
    const doctorId = (req.user && (req.user.userId || req.user.id)) || (body as any).doctorId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    if (!doctorId) {
      throw new BadRequestException('Doctor ID is required');
    }

    const order = await this.orderService.createOrder(body, doctorId, tenantId);
    return { success: true, order };
  }

  @Get('patient/:patientId')
  async getOrdersForPatient(@Param('patientId') patientId: string, @Req() req: any) {
    try {
      const tenantId = req.tenantId;
      const orders = await this.orderService.getOrdersForPatient(patientId, tenantId);
      return { orders, total: orders.length };
    } catch (error) {
      console.error('Error fetching orders for patient:', error);
      return { orders: [], total: 0 };
    }
  }

  @Get('authorized')
  async getAuthorizedOrders(@Req() req: any) {
    try {
      const tenantId = req.tenantId;
      const orders = await this.orderService.getAuthorizedOrdersForNurse(tenantId);
      return { orders, total: orders.length };
    } catch (error) {
      console.error('Error fetching authorized orders:', error);
      // Return empty array instead of throwing error
      return { orders: [], total: 0 };
    }
  }

  @Get('doctor')
  async getOrdersByDoctor(@Req() req: any) {
    try {
      const tenantId = req.tenantId;
      const doctorId = req.user.id;
      const orders = await this.orderService.getOrdersByDoctor(doctorId, tenantId);
      return { orders, total: orders.length };
    } catch (error) {
      console.error('Error fetching orders by doctor:', error);
      return { orders: [], total: 0 };
    }
  }

  @Put(':id/authorize')
  async authorizeOrder(@Param('id') orderId: string, @Req() req: any) {
    const tenantId = req.tenantId;
    const authorizedBy = req.user.id;
    
    const order = await this.orderService.authorizeOrder(orderId, authorizedBy, tenantId);
    return { success: true, order };
  }

  @Put(':id/execute')
  async executeOrder(
    @Param('id') orderId: string, 
    @Body() body: { executionNotes: string }, 
    @Req() req: any
  ) {
    const tenantId = req.tenantId;
    const executedBy = req.user.id;
    
    const order = await this.orderService.executeOrder(orderId, executedBy, body.executionNotes, tenantId);
    return { success: true, order };
  }

  @Put(':id/status')
  async updateOrderStatus(
    @Param('id') orderId: string,
    @Body() body: { status: OrderStatus },
    @Req() req: any
  ) {
    const tenantId = req.tenantId;
    const order = await this.orderService.updateOrderStatus(orderId, body.status, tenantId);
    return { success: true, order };
  }

  @Get(':id')
  async getOrderById(@Param('id') orderId: string, @Req() req: any) {
    const tenantId = req.tenantId;
    const order = await this.orderService.getOrderById(orderId, tenantId);
    return { order };
  }
}
