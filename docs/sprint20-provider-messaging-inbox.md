# Sprint 20: Provider Messaging/Inbox

## Overview
Secure provider-to-provider messaging system with inbox, message threads, prioritization, and task assignment. Essential for care coordination.

## Goals
- Enable secure provider-to-provider communication
- Improve care coordination
- Reduce communication delays
- Track message threads
- Support task assignment via messages
- Ensure message delivery and read receipts

---

## Database Schema

### Messages Table
```sql
CREATE TABLE provider_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID, -- For grouping related messages
  sender_id UUID NOT NULL REFERENCES users(id),
  recipient_id UUID REFERENCES users(id), -- NULL if sent to role/team
  recipient_role VARCHAR(50), -- If sent to role instead of user
  recipient_team VARCHAR(100), -- If sent to team/department
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
  patient_id UUID REFERENCES patients(id), -- If message relates to patient
  appointment_id UUID REFERENCES appointments(id), -- If message relates to appointment
  related_entity_type VARCHAR(50), -- 'lab_order', 'prescription', 'referral', etc.
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
);

CREATE INDEX idx_messages_sender_id ON provider_messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON provider_messages(recipient_id);
CREATE INDEX idx_messages_thread_id ON provider_messages(thread_id);
CREATE INDEX idx_messages_status ON provider_messages(status);
CREATE INDEX idx_messages_priority ON provider_messages(priority);
CREATE INDEX idx_messages_patient_id ON provider_messages(patient_id);
CREATE INDEX idx_messages_sent_at ON provider_messages(sent_at);
CREATE INDEX idx_messages_requires_response ON provider_messages(requires_response);
```

### Message Attachments Table
```sql
CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES provider_messages(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  file_url TEXT,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_message_attachments_message_id ON message_attachments(message_id);
```

### Message Threads Table
```sql
CREATE TABLE message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject VARCHAR(255) NOT NULL,
  patient_id UUID REFERENCES patients(id),
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of user IDs
  last_message_at TIMESTAMP WITH TIME ZONE,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_message_threads_patient_id ON message_threads(patient_id);
CREATE INDEX idx_message_threads_last_message_at ON message_threads(last_message_at);
CREATE INDEX idx_message_threads_is_archived ON message_threads(is_archived);
```

### Message Read Receipts Table
```sql
CREATE TABLE message_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES provider_messages(id) ON DELETE CASCADE,
  read_by UUID NOT NULL REFERENCES users(id),
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, read_by)
);

CREATE INDEX idx_read_receipts_message_id ON message_read_receipts(message_id);
CREATE INDEX idx_read_receipts_read_by ON message_read_receipts(read_by);
```

### Message Tasks Table (Task Assignment via Messages)
```sql
CREATE TABLE message_tasks (
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
);

CREATE INDEX idx_message_tasks_message_id ON message_tasks(message_id);
CREATE INDEX idx_message_tasks_assigned_to ON message_tasks(assigned_to);
CREATE INDEX idx_message_tasks_status ON message_tasks(status);
CREATE INDEX idx_message_tasks_due_date ON message_tasks(due_date);
```

### Message Templates Table
```sql
CREATE TABLE message_templates (
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
  variables JSONB DEFAULT '[]'::jsonb, -- Available variables
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_message_templates_category ON message_templates(category);
CREATE INDEX idx_message_templates_is_active ON message_templates(is_active);
```

---

## Backend Services

### ProviderMessagingService
**Location:** `services/ehr-service/src/services/provider-messaging.service.ts`

**Key Methods:**
- `sendMessage(messageData, tenantDb)` - Send message
- `getInbox(userId, filters, tenantDb)` - Get inbox messages
- `getSentMessages(userId, filters, tenantDb)` - Get sent messages
- `getMessageById(messageId, tenantDb)` - Get message details
- `replyToMessage(messageId, replyData, tenantDb)` - Reply to message
- `forwardMessage(messageId, forwardData, tenantDb)` - Forward message
- `markAsRead(messageId, userId, tenantDb)` - Mark as read
- `markAsUnread(messageId, userId, tenantDb)` - Mark as unread
- `archiveMessage(messageId, userId, tenantDb)` - Archive message
- `deleteMessage(messageId, userId, tenantDb)` - Delete message
- `getMessageThread(threadId, tenantDb)` - Get thread messages
- `createThread(threadData, tenantDb)` - Create new thread
- `addAttachment(messageId, file, tenantDb)` - Add attachment
- `getUnreadCount(userId, tenantDb)` - Get unread message count
- `searchMessages(userId, query, tenantDb)` - Search messages
- `createTaskFromMessage(messageId, taskData, tenantDb)` - Create task from message
- `getMessageTasks(messageId, tenantDb)` - Get tasks from message

### MessageTemplateService
**Location:** `services/ehr-service/src/services/message-template.service.ts`

**Key Methods:**
- `createTemplate(templateData, tenantDb)` - Create template
- `getTemplates(category, tenantDb)` - Get templates
- `applyTemplate(templateId, variables, tenantDb)` - Apply template

---

## API Endpoints

### Message Management
- `POST /messages` - Send message
- `GET /messages/inbox` - Get inbox (with filters)
- `GET /messages/sent` - Get sent messages
- `GET /messages/:id` - Get message details
- `POST /messages/:id/reply` - Reply to message
- `POST /messages/:id/forward` - Forward message
- `PUT /messages/:id/read` - Mark as read
- `PUT /messages/:id/unread` - Mark as unread
- `POST /messages/:id/archive` - Archive message
- `DELETE /messages/:id` - Delete message
- `GET /messages/unread-count` - Get unread count
- `GET /messages/search` - Search messages

### Message Threads
- `GET /messages/threads` - Get message threads
- `GET /messages/threads/:id` - Get thread messages
- `POST /messages/threads` - Create new thread
- `POST /messages/threads/:id/archive` - Archive thread

### Message Attachments
- `POST /messages/:id/attachments` - Add attachment
- `GET /messages/:id/attachments` - Get attachments
- `DELETE /messages/:id/attachments/:attachmentId` - Delete attachment

### Message Tasks
- `POST /messages/:id/tasks` - Create task from message
- `GET /messages/:id/tasks` - Get tasks from message
- `PUT /messages/tasks/:taskId` - Update task
- `POST /messages/tasks/:taskId/complete` - Complete task

### Message Templates
- `GET /messages/templates` - Get templates
- `GET /messages/templates/:id` - Get template details
- `POST /messages/templates` - Create template
- `PUT /messages/templates/:id` - Update template
- `POST /messages/templates/:id/apply` - Apply template

---

## Frontend Components

### Inbox Component
**Location:** `ehr-frontend/src/components/Inbox.tsx`

**Features:**
- List all messages (inbox, sent, archived)
- Filter by status, priority, type
- Search messages
- Unread count badge
- Quick actions (reply, forward, archive, delete)
- Message preview
- Sort by date, priority, sender

### MessageComposer Component
**Location:** `ehr-frontend/src/components/MessageComposer.tsx`

**Features:**
- Compose new message
- Select recipient (user/role/team)
- Set priority
- Attach files
- Use templates
- Link to patient/appointment
- Create task from message
- Schedule send (optional)

### MessageThread Component
**Location:** `ehr-frontend/src/components/MessageThread.tsx`

**Features:**
- View message thread
- Reply to thread
- Forward message
- View attachments
- View read receipts
- View tasks
- Archive thread

### MessageViewer Component
**Location:** `ehr-frontend/src/components/MessageViewer.tsx`

**Features:**
- View message details
- View sender/recipient info
- View attachments
- View related patient/appointment
- Reply/forward actions
- Mark as read/unread
- Archive/delete

### MessageTemplates Component
**Location:** `ehr-frontend/src/components/MessageTemplates.tsx`

**Features:**
- Browse templates
- Preview template
- Apply template
- Create custom templates
- Edit templates

---

## Message Types

1. **Message** - General communication
2. **Task** - Task assignment
3. **Alert** - Important alert
4. **Notification** - System notification
5. **Referral Request** - Referral request
6. **Consultation Request** - Consultation request
7. **Lab Result Alert** - Lab result notification
8. **Critical Alert** - Critical patient alert

---

## Integration Points

- **Notification Service** - Real-time notifications
- **Task Service** - Create tasks from messages
- **Patient Service** - Link to patient records
- **Appointment Service** - Link to appointments
- **Email Service** - Email notifications for urgent messages
- **Audit Service** - Log all message activity

---

## Real-Time Features

- Real-time message delivery
- Read receipt tracking
- Unread count updates
- New message notifications
- Typing indicators (optional)

---

## Testing Checklist

- [ ] Send message to user
- [ ] Send message to role/team
- [ ] Reply to message
- [ ] Forward message
- [ ] Mark as read/unread
- [ ] Archive message
- [ ] Delete message
- [ ] Add attachment
- [ ] Create task from message
- [ ] Use message template
- [ ] Search messages
- [ ] Filter messages
- [ ] View message thread
- [ ] Read receipts
- [ ] Unread count



---

---

## ⚠️ **CRITICAL IMPLEMENTATION GUIDELINES**

### **Database Provisioning**
- ✅ **ALWAYS provision database changes** - If database schema is modified, MUST provision it
- ✅ **Execute on bulawayo-general tenant** - All database changes MUST be tested on `bulawayo-general` tenant
- ✅ **Use provisioning bundle** - Add to `database-provisioning.service.ts` as a new bundle
- ✅ **Create provisioning script** - Create script in `scripts/` folder to apply to specific tenant

### **UI/UX Standards**
- ✅ **Follow existing component patterns** - Match UI/UX of existing components (DoctorDashboard, PatientPortal, etc.)
- ✅ **Use consistent styling** - Follow Tailwind CSS patterns already established
- ✅ **Polish all interfaces** - Ensure professional, modern UI matching existing quality
- ⚠️ **NEVER use default JavaScript alerts** - Always use modern UI components (ConfirmDialog, GlobalNotification) instead of `alert()`, `confirm()`, or `window.alert()`

### **Feature Completeness**
- ✅ **Complete feature sets** - If doctor feature needs nurse/patient features, implement ALL together
- ✅ **Do not move forward** - Complete all related features before moving to next item
- ✅ **Test end-to-end** - Test complete workflows across all user roles

### **Implementation Order**
1. Database schema → Provision → Test on bulawayo-general
2. Backend services → API endpoints
3. Frontend components (all roles if needed) → Polish UI/UX
4. Integration testing → End-to-end workflows
5. Documentation update


---

## Estimated Effort: 3-4 weeks

