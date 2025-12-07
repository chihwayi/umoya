import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

async function provisionSprint20Messaging() {
  const tenantSlug = 'bulawayo-general';
  const tenantDbName = `tenant_${tenantSlug.replace(/-/g, '_')}`;

  console.log(`\n🔧 Provisioning Sprint 20 - Provider Messaging for tenant: ${tenantSlug}`);
  console.log(`📦 Database: ${tenantDbName}\n`);

  // Connect to tenant database
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'medicore',
    password: process.env.DB_PASSWORD || 'medicore_password',
    database: tenantDbName,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Connected to tenant database\n');

    const statements: string[] = [];

    // Provider Messages Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS provider_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id UUID,
        sender_id UUID NOT NULL REFERENCES users(id),
        recipient_id UUID REFERENCES users(id),
        recipient_role VARCHAR(50),
        recipient_team VARCHAR(100),
        subject VARCHAR(255) NOT NULL,
        message_text TEXT NOT NULL,
        message_type VARCHAR(50) NOT NULL DEFAULT 'message' CHECK (message_type IN (
          'message',
          'task',
          'alert',
          'notification',
          'referral_request',
          'consultation_request',
          'lab_result_alert',
          'critical_alert'
        )),
        priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        status VARCHAR(50) NOT NULL DEFAULT 'sent' CHECK (status IN (
          'draft',
          'sent',
          'delivered',
          'read',
          'archived',
          'deleted'
        )),
        patient_id UUID REFERENCES patients(id),
        appointment_id UUID REFERENCES appointments(id),
        related_entity_type VARCHAR(50),
        related_entity_id UUID,
        requires_response BOOLEAN DEFAULT false,
        response_required_by TIMESTAMP WITH TIME ZONE,
        is_urgent BOOLEAN DEFAULT false,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        delivered_at TIMESTAMP WITH TIME ZONE,
        read_at TIMESTAMP WITH TIME ZONE,
        archived_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Message Attachments Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS message_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES provider_messages(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500),
        file_url TEXT,
        file_size INTEGER,
        mime_type VARCHAR(100),
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Message Threads Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS message_threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subject VARCHAR(255) NOT NULL,
        patient_id UUID REFERENCES patients(id),
        related_entity_type VARCHAR(50),
        related_entity_id UUID,
        participants JSONB NOT NULL DEFAULT '[]'::jsonb,
        last_message_at TIMESTAMP WITH TIME ZONE,
        is_archived BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Message Read Receipts Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS message_read_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES provider_messages(id) ON DELETE CASCADE,
        read_by UUID NOT NULL REFERENCES users(id),
        read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(message_id, read_by)
      )
    `);

    // Message Tasks Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS message_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES provider_messages(id) ON DELETE CASCADE,
        task_title VARCHAR(255) NOT NULL,
        task_description TEXT,
        assigned_to UUID NOT NULL REFERENCES users(id),
        assigned_by UUID NOT NULL REFERENCES users(id),
        due_date TIMESTAMP WITH TIME ZONE,
        priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
          'pending',
          'in_progress',
          'completed',
          'cancelled'
        )),
        completed_at TIMESTAMP WITH TIME ZONE,
        completion_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Message Templates Table
    statements.push(`
      CREATE TABLE IF NOT EXISTS message_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) CHECK (category IN (
          'consultation',
          'referral',
          'lab_result',
          'follow_up',
          'urgent_alert',
          'general'
        )),
        subject_template VARCHAR(255) NOT NULL,
        message_template TEXT NOT NULL,
        variables JSONB DEFAULT '[]'::jsonb,
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Execute all table creation statements
    console.log('📋 Creating tables...');
    for (const statement of statements) {
      await dataSource.query(statement);
    }
    console.log('✅ Tables created successfully\n');

    // Create indexes
    console.log('📋 Creating indexes...');
    const indexes = [
      // Provider Messages indexes
      `CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON provider_messages(sender_id)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON provider_messages(recipient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON provider_messages(thread_id)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_status ON provider_messages(status)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_priority ON provider_messages(priority)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_patient_id ON provider_messages(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON provider_messages(sent_at)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_requires_response ON provider_messages(requires_response)`,
      
      // Message Attachments indexes
      `CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id)`,
      
      // Message Threads indexes
      `CREATE INDEX IF NOT EXISTS idx_message_threads_patient_id ON message_threads(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_message_threads_last_message_at ON message_threads(last_message_at)`,
      `CREATE INDEX IF NOT EXISTS idx_message_threads_is_archived ON message_threads(is_archived)`,
      
      // Message Read Receipts indexes
      `CREATE INDEX IF NOT EXISTS idx_read_receipts_message_id ON message_read_receipts(message_id)`,
      `CREATE INDEX IF NOT EXISTS idx_read_receipts_read_by ON message_read_receipts(read_by)`,
      
      // Message Tasks indexes
      `CREATE INDEX IF NOT EXISTS idx_message_tasks_message_id ON message_tasks(message_id)`,
      `CREATE INDEX IF NOT EXISTS idx_message_tasks_assigned_to ON message_tasks(assigned_to)`,
      `CREATE INDEX IF NOT EXISTS idx_message_tasks_status ON message_tasks(status)`,
      `CREATE INDEX IF NOT EXISTS idx_message_tasks_due_date ON message_tasks(due_date)`,
      
      // Message Templates indexes
      `CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category)`,
      `CREATE INDEX IF NOT EXISTS idx_message_templates_is_active ON message_templates(is_active)`,
    ];

    for (const index of indexes) {
      await dataSource.query(index);
    }
    console.log('✅ Indexes created successfully\n');

    console.log('🎉 Sprint 20 - Provider Messaging provisioning completed successfully!\n');
    console.log('📊 Tables created:');
    console.log('  - provider_messages');
    console.log('  - message_attachments');
    console.log('  - message_threads');
    console.log('  - message_read_receipts');
    console.log('  - message_tasks');
    console.log('  - message_templates\n');

  } catch (error) {
    console.error('❌ Error provisioning Sprint 20:', error);
    throw error;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('✅ Database connection closed');
    }
  }
}

provisionSprint20Messaging()
  .then(() => {
    console.log('\n✅ Provisioning completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Provisioning failed:', error);
    process.exit(1);
  });

