import { Controller, Post, Get, Put, Body, Param, Req, Query } from '@nestjs/common';
import { OrderService, CreateOrderDto, UpdateOrderDto } from '../services/order.service';
import { OrderType, OrderStatus } from '../entities/order.entity';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async createOrder(@Body() body: CreateOrderDto, @Req() req: any) {
    const tenantId = req.tenantId;
    const doctorId = req.user.id;
    
    const order = await this.orderService.createOrder(body, doctorId, tenantId);
    return { success: true, order };
  }

  @Get('patient/:patientId')
  async getOrdersForPatient(@Param('patientId') patientId: string, @Req() req: any) {
    const tenantId = req.tenantId;
    const orders = await this.orderService.getOrdersForPatient(patientId, tenantId);
    return { orders, total: orders.length };
  }

  @Get('authorized')
  async getAuthorizedOrders(@Req() req: any) {
    const tenantId = req.tenantId;
    const orders = await this.orderService.getAuthorizedOrdersForNurse(tenantId);
    return { orders, total: orders.length };
  }

  @Get('doctor')
  async getOrdersByDoctor(@Req() req: any) {
    const tenantId = req.tenantId;
    const doctorId = req.user.id;
    const orders = await this.orderService.getOrdersByDoctor(doctorId, tenantId);
    return { orders, total: orders.length };
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
