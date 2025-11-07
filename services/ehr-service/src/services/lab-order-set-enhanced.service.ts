import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class LabOrderSetEnhancedService {
  private readonly logger = new Logger(LabOrderSetEnhancedService.name);

  async getAllOrderSets(tenantDb: DataSource, filters: { category?: string; active?: boolean } = {}) {
    const query = `
      SELECT 
        os.*,
        COUNT(osi.id) as test_count
      FROM lab_order_sets os
      LEFT JOIN lab_order_set_items osi ON osi.order_set_id = os.id
      WHERE 1=1
        ${filters.category ? `AND os.category = $1` : ''}
        ${filters.active !== undefined ? `AND os.is_active = $${filters.category ? 2 : 1}` : ''}
      GROUP BY os.id
      ORDER BY os.category, os.set_name
    `;

    const params = [];
    if (filters.category) params.push(filters.category);
    if (filters.active !== undefined) params.push(filters.active);

    const orderSets = await tenantDb.query(query, params);
    return { orderSets, total: orderSets.length };
  }

  async getOrderSetById(tenantDb: DataSource, id: string) {
    const orderSet = await tenantDb.query(
      `
      SELECT * FROM lab_order_sets
      WHERE id = $1
      `,
      [id],
    );

    if (orderSet.length === 0) {
      throw new NotFoundException(`Order set with ID ${id} not found`);
    }

    // Get tests in this order set
    const tests = await this.getOrderSetTests(tenantDb, id);

    return { ...orderSet[0], tests: tests.tests };
  }

  async getOrderSetTests(tenantDb: DataSource, orderSetId: string) {
    const tests = await tenantDb.query(
      `
      SELECT 
        tc.*,
        osi.sort_order,
        osi.id as order_set_item_id,
        COUNT(comp.id) as component_count
      FROM lab_order_set_items osi
      INNER JOIN lab_test_catalog tc ON tc.id = osi.test_catalog_id
      LEFT JOIN lab_test_components comp ON comp.test_catalog_id = tc.id
      WHERE osi.order_set_id = $1
      GROUP BY tc.id, osi.id, osi.sort_order
      ORDER BY osi.sort_order, tc.test_name
      `,
      [orderSetId],
    );

    return { tests, total: tests.length };
  }

  async createOrderSet(tenantDb: DataSource, orderSetData: any, userId?: string) {
    const { set_name, set_code, description, category, is_default, test_ids } = orderSetData;

    // Check if set_code already exists
    const existing = await tenantDb.query(
      `SELECT id FROM lab_order_sets WHERE set_code = $1`,
      [set_code],
    );

    if (existing.length > 0) {
      throw new BadRequestException(`Order set with code ${set_code} already exists`);
    }

    // Create order set
    const result = await tenantDb.query(
      `
      INSERT INTO lab_order_sets (
        set_name, set_code, description, category, is_default, is_active,
        test_ids, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, true, '[]'::jsonb, NOW(), NOW())
      RETURNING *
      `,
      [set_name, set_code, description, category, is_default || false],
    );

    const newOrderSet = result[0];

    // Add tests to the order set if provided
    if (test_ids && Array.isArray(test_ids) && test_ids.length > 0) {
      for (let i = 0; i < test_ids.length; i++) {
        await this.addTestToOrderSet(tenantDb, newOrderSet.id, test_ids[i], i + 1);
      }
    }

    this.logger.log(`Created order set: ${set_name} (${set_code}) with ${test_ids?.length || 0} tests`);
    return newOrderSet;
  }

  async updateOrderSet(tenantDb: DataSource, id: string, orderSetData: any) {
    const { set_name, description, category, is_default, is_active } = orderSetData;

    const result = await tenantDb.query(
      `
      UPDATE lab_order_sets
      SET 
        set_name = COALESCE($1, set_name),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        is_default = COALESCE($4, is_default),
        is_active = COALESCE($5, is_active),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
      `,
      [set_name, description, category, is_default, is_active, id],
    );

    if (result.length === 0) {
      throw new NotFoundException(`Order set with ID ${id} not found`);
    }

    this.logger.log(`Updated order set: ${id}`);
    return result[0];
  }

  async deleteOrderSet(tenantDb: DataSource, id: string) {
    // Delete order set items first (CASCADE should handle this, but being explicit)
    await tenantDb.query(`DELETE FROM lab_order_set_items WHERE order_set_id = $1`, [id]);

    // Delete order set
    const result = await tenantDb.query(
      `DELETE FROM lab_order_sets WHERE id = $1 RETURNING *`,
      [id],
    );

    if (result.length === 0) {
      throw new NotFoundException(`Order set with ID ${id} not found`);
    }

    this.logger.log(`Deleted order set: ${id}`);
    return result[0];
  }

  async addTestToOrderSet(
    tenantDb: DataSource,
    orderSetId: string,
    testCatalogId: string,
    sortOrder?: number,
  ) {
    // Check if test already in order set
    const existing = await tenantDb.query(
      `
      SELECT id FROM lab_order_set_items
      WHERE order_set_id = $1 AND test_catalog_id = $2
      `,
      [orderSetId, testCatalogId],
    );

    if (existing.length > 0) {
      throw new BadRequestException('Test already in this order set');
    }

    // Get next sort order if not provided
    if (sortOrder === undefined) {
      const maxSort = await tenantDb.query(
        `
        SELECT COALESCE(MAX(sort_order), 0) as max_sort
        FROM lab_order_set_items
        WHERE order_set_id = $1
        `,
        [orderSetId],
      );
      sortOrder = (maxSort[0]?.max_sort || 0) + 1;
    }

    const result = await tenantDb.query(
      `
      INSERT INTO lab_order_set_items (order_set_id, test_catalog_id, sort_order)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [orderSetId, testCatalogId, sortOrder],
    );

    this.logger.log(`Added test ${testCatalogId} to order set ${orderSetId}`);
    return result[0];
  }

  async removeTestFromOrderSet(tenantDb: DataSource, orderSetId: string, testCatalogId: string) {
    const result = await tenantDb.query(
      `
      DELETE FROM lab_order_set_items
      WHERE order_set_id = $1 AND test_catalog_id = $2
      RETURNING *
      `,
      [orderSetId, testCatalogId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Test not found in this order set');
    }

    this.logger.log(`Removed test ${testCatalogId} from order set ${orderSetId}`);
    return result[0];
  }

  async reorderTests(
    tenantDb: DataSource,
    orderSetId: string,
    testOrders: Array<{ test_catalog_id: string; sort_order: number }>,
  ) {
    for (const testOrder of testOrders) {
      await tenantDb.query(
        `
        UPDATE lab_order_set_items
        SET sort_order = $1
        WHERE order_set_id = $2 AND test_catalog_id = $3
        `,
        [testOrder.sort_order, orderSetId, testOrder.test_catalog_id],
      );
    }

    this.logger.log(`Reordered ${testOrders.length} tests in order set ${orderSetId}`);
    return { updated: testOrders.length };
  }

  async createOrdersFromSet(tenantDb: DataSource, orderData: any, userId?: string) {
    const { order_set_id, patient_id, ordering_provider_id, priority, clinical_indication } = orderData;

    // Get order set with tests
    const orderSet = await this.getOrderSetById(tenantDb, order_set_id);

    if (!orderSet.tests || orderSet.tests.length === 0) {
      throw new BadRequestException('Order set has no tests');
    }

    const createdOrders = [];

    // Create a lab order for each test in the set
    for (const test of orderSet.tests) {
      // Generate order number
      const orderNumber = `LAB-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

      // Create lab order
      const order = await tenantDb.query(
        `
        INSERT INTO lab_orders (
          order_number, patient_id, ordering_provider_id, ordering_provider,
          test_catalog_id, order_set_id, priority, status, 
          clinical_indication, tests, created_at, updated_at
        )
        VALUES ($1, $2, $3, $3, $4, $5, $6, 'ordered', $7, $8, NOW(), NOW())
        RETURNING *
        `,
        [
          orderNumber,
          patient_id,
          ordering_provider_id,
          test.id,
          order_set_id,
          priority || 'routine',
          clinical_indication,
          JSON.stringify([
            {
              testCode: test.test_code,
              testName: test.test_name,
              category: test.category,
            },
          ]),
        ],
      );

      createdOrders.push(order[0]);
    }

    this.logger.log(
      `Created ${createdOrders.length} lab orders from order set ${orderSet.set_name} for patient ${patient_id}`,
    );

    return { orders: createdOrders, total: createdOrders.length };
  }
}

