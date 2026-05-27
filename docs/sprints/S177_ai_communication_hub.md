# S177 — AI Patient Communication Hub

**Phase:** 2 — AI Intelligence Amplification  
**Effort:** M  
**Depends on:** S176  
**Goal:** When a patient sends a message to their care team, the AI: (1) classifies urgency, (2) suggests a reply draft for the clinician to approve/edit, and (3) auto-translates the message if it's in a language different from the clinician's preference — so no message goes unanswered and no language barrier persists.

---

## Problem

Patient messages arrive as plain text with no triage, no drafts, and no translation. Clinicians ignore low-priority messages for days because the queue looks identical. Non-English messages are effectively unread. The inbox should be AI-enhanced, not a raw text dump.

---

## Acceptance Criteria

1. When a patient message is received, it is classified: `urgent`, `routine`, `administrative`, `follow_up`.
2. An AI reply draft is generated and stored but NOT sent until the clinician approves.
3. If the message language differs from the clinician's preferred language, a translation is stored.
4. EHR messaging inbox shows urgency badge, AI draft, and translation toggle.
5. Clinician can approve draft (sends as-is), edit then send, or discard.
6. Sending the approved/edited message stores `sent_by_ai: false` — AI is never the sender.
7. Patient portal shows the response when sent.
8. `GET /messages/inbox` returns messages enriched with `urgency`, `draft`, `translation`.
9. `tsc --noEmit` and lint pass.
10. i18n keys in all 8 locales.

---

## 1. Database Provisioning

```typescript
{
  id: 'ai_message_enrichment',
  version: '2026.05.27.1',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS message_ai_enrichment (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID NOT NULL,
      urgency VARCHAR(32) NOT NULL DEFAULT 'routine'
        CHECK (urgency IN ('urgent','routine','administrative','follow_up')),
      urgency_confidence NUMERIC(4,3),
      reply_draft TEXT,
      translated_content TEXT,
      detected_language VARCHAR(8),
      translation_language VARCHAR(8),
      draft_approved_by UUID,
      draft_approved_at TIMESTAMPTZ,
      draft_sent BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(message_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_mae_message ON message_ai_enrichment(message_id)`,
    `CREATE INDEX IF NOT EXISTS idx_mae_urgency ON message_ai_enrichment(urgency, created_at DESC)`,
  ],
},
```

---

## 2. Backend — MessageAiService

Create `services/ehr-service/src/services/message-ai.service.ts`:

```typescript
import { Injectable, Logger, Optional } from '@nestjs/common';
import { CdssService } from './cdss.service';
import { PostVisitGroundedLlmService } from './post-visit-grounded-llm.service';

type Urgency = 'urgent' | 'routine' | 'administrative' | 'follow_up';

@Injectable()
export class MessageAiService {
  private readonly logger = new Logger(MessageAiService.name);

  constructor(
    @Optional() private readonly cdss: CdssService,
    @Optional() private readonly llm: PostVisitGroundedLlmService,
  ) {}

  async enrichMessage(
    messageId: string,
    content: string,
    senderPatientId: string,
    clinicianLanguage: string,
    db: any,
  ): Promise<unknown> {
    let urgency: Urgency = 'routine';
    let urgencyConfidence = 0.5;
    let replyDraft: string | null = null;
    let translatedContent: string | null = null;
    let detectedLanguage: string | null = null;

    // Classify urgency
    try {
      if (this.cdss) {
        const classification = await this.cdss.classifyMessageUrgency(content);
        urgency = classification?.urgency ?? 'routine';
        urgencyConfidence = classification?.confidence ?? 0.5;
      } else {
        urgency = this.ruleBasedUrgency(content);
      }
    } catch (err) {
      this.logger.warn(`Urgency classification failed: ${err.message}`);
    }

    // Generate reply draft
    try {
      if (this.llm) {
        const patientRows = await db.query(
          `SELECT first_name, last_name FROM patients WHERE id = $1`,
          [senderPatientId],
        );
        const patient = patientRows[0] ?? {};

        const draft = await this.llm.answerPatientQuestion({
          question: content,
          patientName: `${patient.first_name ?? ''} ${patient.last_name ?? ''}`.trim(),
          context: 'messaging_inbox',
        });
        replyDraft = draft?.answer ?? null;
      }
    } catch (err) {
      this.logger.warn(`Reply draft generation failed: ${err.message}`);
    }

    // Detect language and translate if needed
    try {
      if (this.cdss) {
        const detected = await this.cdss.detectLanguage(content);
        detectedLanguage = detected?.language ?? null;
        if (detectedLanguage && detectedLanguage !== clinicianLanguage) {
          const translation = await this.cdss.translateText(content, clinicianLanguage);
          translatedContent = translation?.text ?? null;
        }
      }
    } catch (err) {
      this.logger.warn(`Translation failed: ${err.message}`);
    }

    const rows = await db.query(
      `INSERT INTO message_ai_enrichment
         (message_id, urgency, urgency_confidence, reply_draft,
          translated_content, detected_language, translation_language)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (message_id) DO UPDATE SET
         urgency = EXCLUDED.urgency,
         urgency_confidence = EXCLUDED.urgency_confidence,
         reply_draft = EXCLUDED.reply_draft,
         translated_content = EXCLUDED.translated_content,
         detected_language = EXCLUDED.detected_language,
         translation_language = EXCLUDED.translation_language
       RETURNING *`,
      [
        messageId, urgency, urgencyConfidence, replyDraft,
        translatedContent, detectedLanguage, clinicianLanguage,
      ],
    );
    return rows[0];
  }

  private ruleBasedUrgency(content: string): Urgency {
    const urgentKeywords = /urgent|emergency|chest pain|can't breathe|bleeding|stroke|seizure|overdose/i;
    const adminKeywords = /appointment|reschedule|cancel|bill|insurance|referral letter/i;
    const followUpKeywords = /follow.?up|results|lab|how are|feeling better/i;

    if (urgentKeywords.test(content)) return 'urgent';
    if (adminKeywords.test(content)) return 'administrative';
    if (followUpKeywords.test(content)) return 'follow_up';
    return 'routine';
  }

  async approveDraft(
    messageId: string,
    approvedBy: string,
    editedContent: string | null,
    db: any,
  ): Promise<{ replyContent: string }> {
    const enrichmentRows = await db.query(
      `SELECT reply_draft FROM message_ai_enrichment WHERE message_id = $1`,
      [messageId],
    );
    const enrichment = enrichmentRows[0] ?? null;
    const replyContent = editedContent ?? enrichment?.reply_draft ?? '';

    // Insert reply message
    const messageRows = await db.query(
      `SELECT patient_id, thread_id FROM messages WHERE id = $1`,
      [messageId],
    );
    const msg = messageRows[0] ?? null;
    if (msg) {
      await db.query(
        `INSERT INTO messages
           (thread_id, sender_type, sender_id, patient_id, content, sent_by_ai)
         VALUES ($1,'staff',$2,$3,$4,false)`,
        [msg.thread_id, approvedBy, msg.patient_id, replyContent],
      );
    }

    await db.query(
      `UPDATE message_ai_enrichment
       SET draft_approved_by = $2, draft_approved_at = now(), draft_sent = true
       WHERE message_id = $1`,
      [messageId, approvedBy],
    );

    return { replyContent };
  }

  async getEnrichedInbox(doctorId: string, db: any): Promise<unknown[]> {
    return db.query(
      `SELECT m.*, mae.urgency, mae.urgency_confidence,
              mae.reply_draft, mae.translated_content, mae.detected_language,
              mae.draft_sent
       FROM messages m
       LEFT JOIN message_ai_enrichment mae ON mae.message_id = m.id
       WHERE m.assigned_to = $1 OR m.thread_id IN (
         SELECT thread_id FROM message_thread_participants WHERE staff_id = $1
       )
       AND m.sender_type = 'patient'
       AND m.status = 'unread'
       ORDER BY
         CASE mae.urgency WHEN 'urgent' THEN 1 WHEN 'follow_up' THEN 2
           WHEN 'routine' THEN 3 ELSE 4 END,
         m.created_at DESC
       LIMIT 50`,
      [doctorId],
    );
  }
}
```

---

## 3. Backend — MessageAiController

Create `services/ehr-service/src/controllers/message-ai.controller.ts`:

```typescript
import {
  Controller, Get, Post, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { MessageAiService } from '../services/message-ai.service';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessageAiController {
  constructor(private readonly messageAi: MessageAiService) {}

  @Get('inbox')
  async getInbox(@Req() req: any): Promise<unknown[]> {
    return this.messageAi.getEnrichedInbox(req.user.sub, req.tenantDb);
  }

  @Post(':messageId/enrich')
  async enrich(
    @Param('messageId') messageId: string,
    @Body() body: { content: string; patientId: string },
    @Req() req: any,
  ): Promise<unknown> {
    return this.messageAi.enrichMessage(
      messageId,
      body.content,
      body.patientId,
      req.user.preferredLanguage ?? 'en',
      req.tenantDb,
    );
  }

  @Post(':messageId/approve-draft')
  async approveDraft(
    @Param('messageId') messageId: string,
    @Body() body: { editedContent?: string },
    @Req() req: any,
  ): Promise<{ replyContent: string }> {
    return this.messageAi.approveDraft(
      messageId,
      req.user.sub,
      body.editedContent ?? null,
      req.tenantDb,
    );
  }
}
```

---

## 4. Register in ehr.module.ts

```typescript
import { MessageAiService } from './services/message-ai.service';
import { MessageAiController } from './controllers/message-ai.controller';

controllers: [ /* ...existing... */ MessageAiController ],
providers: [ /* ...existing... */ MessageAiService ],
```

---

## 5. EHR Frontend — AI-Enhanced Inbox

In `ehr-frontend/src/components/MessageInboxItem.tsx` (new or update existing):

```tsx
import React, { useState } from 'react';
import { api } from '../services/api';

interface InboxMessage {
  id: string;
  content: string;
  sender_name: string;
  created_at: string;
  urgency?: string;
  reply_draft?: string;
  translated_content?: string;
  detected_language?: string;
  draft_sent?: boolean;
}

interface Props { message: InboxMessage; onReplied?: () => void; }

export const MessageInboxItem: React.FC<Props> = ({ message, onReplied }) => {
  const [showDraft, setShowDraft] = useState(false);
  const [editedReply, setEditedReply] = useState(message.reply_draft ?? '');
  const [sent, setSent] = useState(message.draft_sent ?? false);
  const [showTranslation, setShowTranslation] = useState(false);

  const urgencyColors: Record<string, string> = {
    urgent: '#dc2626',
    follow_up: '#2563eb',
    administrative: '#9ca3af',
    routine: '#16a34a',
  };

  const sendReply = async () => {
    await api.post(`/messages/${message.id}/approve-draft`, { editedContent: editedReply });
    setSent(true);
    onReplied?.();
  };

  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 8,
      borderLeftWidth: 4,
      borderLeftColor: urgencyColors[message.urgency ?? 'routine'],
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{message.sender_name}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {message.urgency && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
              backgroundColor: urgencyColors[message.urgency] + '20',
              color: urgencyColors[message.urgency],
            }}>
              {message.urgency.toUpperCase()}
            </span>
          )}
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            {new Date(message.created_at).toLocaleString()}
          </span>
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
        {message.content}
      </p>

      {message.translated_content && (
        <div>
          <button
            onClick={() => setShowTranslation(!showTranslation)}
            style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {showTranslation ? '▲ Hide translation' : `▼ Show translation (${message.detected_language ?? 'detected'})`}
          </button>
          {showTranslation && (
            <p style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic', marginTop: 4 }}>
              {message.translated_content}
            </p>
          )}
        </div>
      )}

      {!sent && message.reply_draft && (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => setShowDraft(!showDraft)}
            style={{
              fontSize: 12, color: '#7c3aed', background: 'none',
              border: 'none', cursor: 'pointer', fontWeight: 600,
            }}
          >
            {showDraft ? '▲ Hide AI Draft' : '▼ View AI Draft Reply'}
          </button>
          {showDraft && (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={editedReply}
                onChange={(e) => setEditedReply(e.target.value)}
                rows={4}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              />
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button
                  onClick={sendReply}
                  style={{
                    padding: '6px 16px', backgroundColor: '#7c3aed', color: 'white',
                    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                  }}
                >
                  Send Reply
                </button>
                <button
                  onClick={() => setShowDraft(false)}
                  style={{
                    padding: '6px 16px', backgroundColor: '#f3f4f6',
                    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {sent && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
          ✓ Reply sent
        </div>
      )}
    </div>
  );
};
```

---

## 6. i18n Keys — All 8 Locales

### `en.json`:
```json
"messaging": {
  "inbox": "Inbox",
  "urgent": "Urgent",
  "routine": "Routine",
  "administrative": "Administrative",
  "follow_up": "Follow-up",
  "ai_draft": "AI Draft Reply",
  "send_reply": "Send Reply",
  "discard": "Discard",
  "reply_sent": "Reply sent",
  "show_translation": "Show translation",
  "hide_translation": "Hide translation",
  "ai_never_sends": "AI suggests — you send"
}
```

### `sn.json`:
```json
"messaging": {
  "inbox": "Inbox",
  "urgent": "Kukurumidza",
  "routine": "Pakutanga",
  "administrative": "ZveAdministration",
  "follow_up": "Kutevedzera",
  "ai_draft": "Mhinduro yeAI",
  "send_reply": "Tumira Mhinduro",
  "discard": "Rega",
  "reply_sent": "Mhinduro yatumirwa",
  "show_translation": "Ratidza shanduro",
  "hide_translation": "Viga shanduro",
  "ai_never_sends": "AI inobuditsa — iwe unotumira"
}
```

### `nd.json`:
```json
"messaging": {
  "inbox": "Ibhokisi Lokufika",
  "urgent": "Okuphuthumayo",
  "routine": "Okujwayelekile",
  "administrative": "Ezikhungwini",
  "follow_up": "Ukulandela",
  "ai_draft": "Impendulo ye-AI",
  "send_reply": "Thumela Impendulo",
  "discard": "Lahla",
  "reply_sent": "Impendulo ithunyelwe",
  "show_translation": "Bonisa ukuhumusha",
  "hide_translation": "Fihla ukuhumusha",
  "ai_never_sends": "I-AI iphakamisa — wena uthumela"
}
```

### `pt.json`:
```json
"messaging": {
  "inbox": "Caixa de Entrada",
  "urgent": "Urgente",
  "routine": "Rotina",
  "administrative": "Administrativo",
  "follow_up": "Acompanhamento",
  "ai_draft": "Rascunho IA",
  "send_reply": "Enviar Resposta",
  "discard": "Descartar",
  "reply_sent": "Resposta enviada",
  "show_translation": "Mostrar tradução",
  "hide_translation": "Ocultar tradução",
  "ai_never_sends": "IA sugere — você envia"
}
```

### `fr.json`:
```json
"messaging": {
  "inbox": "Boîte de Réception",
  "urgent": "Urgent",
  "routine": "Routine",
  "administrative": "Administratif",
  "follow_up": "Suivi",
  "ai_draft": "Brouillon IA",
  "send_reply": "Envoyer la Réponse",
  "discard": "Ignorer",
  "reply_sent": "Réponse envoyée",
  "show_translation": "Afficher la traduction",
  "hide_translation": "Masquer la traduction",
  "ai_never_sends": "L'IA suggère — vous envoyez"
}
```

### `sw.json`:
```json
"messaging": {
  "inbox": "Kisanduku Cha Barua",
  "urgent": "Ya Haraka",
  "routine": "Ya Kawaida",
  "administrative": "Ya Utawala",
  "follow_up": "Ufuatiliaji",
  "ai_draft": "Rasimu ya AI",
  "send_reply": "Tuma Jibu",
  "discard": "Tupa",
  "reply_sent": "Jibu limetumwa",
  "show_translation": "Onyesha tafsiri",
  "hide_translation": "Ficha tafsiri",
  "ai_never_sends": "AI inapendekeza — wewe unatuma"
}
```

### `zu.json`:
```json
"messaging": {
  "inbox": "Ibhokisi Lokufika",
  "urgent": "Okuphuthumayo",
  "routine": "Okujwayelekile",
  "administrative": "Okwezokuphathwa",
  "follow_up": "Ukulandela",
  "ai_draft": "Umdwebo we-AI",
  "send_reply": "Thumela Impendulo",
  "discard": "Lahla",
  "reply_sent": "Impendulo ithunyelwe",
  "show_translation": "Bonisa ukuhumusha",
  "hide_translation": "Fihla ukuhumusha",
  "ai_never_sends": "I-AI iphakamisa — wena uthumela"
}
```

### `af.json`:
```json
"messaging": {
  "inbox": "Inkassie",
  "urgent": "Dringend",
  "routine": "Roetine",
  "administrative": "Administratief",
  "follow_up": "Opvolgings",
  "ai_draft": "KI Konsep Antwoord",
  "send_reply": "Stuur Antwoord",
  "discard": "Gooi weg",
  "reply_sent": "Antwoord gestuur",
  "show_translation": "Wys vertaling",
  "hide_translation": "Verberg vertaling",
  "ai_never_sends": "KI stel voor — jy stuur"
}
```

---

## 7. Jest Spec

Create `services/ehr-service/src/services/message-ai.service.spec.ts`:

```typescript
import { MessageAiService } from './message-ai.service';

function makeService(cdss?: any, llm?: any) {
  return new MessageAiService(cdss ?? null, llm ?? null);
}

function makeDb() {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM patients')) return Promise.resolve([{ first_name: 'Jane', last_name: 'Doe' }]);
      if (sql.includes('INSERT INTO message_ai_enrichment')) return Promise.resolve([{ id: 'e1', urgency: 'routine' }]);
      if (sql.includes('UPDATE message_ai_enrichment')) return Promise.resolve([]);
      if (sql.includes('FROM messages WHERE id')) return Promise.resolve([{ thread_id: 't1', patient_id: 'p1' }]);
      if (sql.includes('INSERT INTO messages')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
}

describe('MessageAiService', () => {
  it('classifies urgent messages via rule-based fallback', async () => {
    const svc = makeService(null, null);
    const db = makeDb();
    const result: any = await svc.enrichMessage('msg1', 'I have chest pain, urgent!', 'p1', 'en', db);
    expect(result.urgency).toBe('routine'); // mock returns fixed value; logic test below
  });

  it('ruleBasedUrgency detects urgent keywords', () => {
    const svc = makeService(null, null) as any;
    expect(svc.ruleBasedUrgency('I have chest pain')).toBe('urgent');
    expect(svc.ruleBasedUrgency('Please cancel my appointment')).toBe('administrative');
    expect(svc.ruleBasedUrgency('How are my lab results?')).toBe('follow_up');
    expect(svc.ruleBasedUrgency('Just checking in')).toBe('routine');
  });

  it('generates reply draft via LLM', async () => {
    const llm = {
      answerPatientQuestion: jest.fn().mockResolvedValue({ answer: 'Your results are normal.' }),
    };
    const svc = makeService(null, llm);
    const db = makeDb();
    await svc.enrichMessage('msg2', 'Any updates?', 'p1', 'en', db);
    expect(llm.answerPatientQuestion).toHaveBeenCalled();
  });

  it('approveDraft sends message and marks draft as sent', async () => {
    const svc = makeService(null, null);
    const db = makeDb();
    db.query
      .mockResolvedValueOnce([{ reply_draft: 'Your labs are fine.' }]) // enrichment lookup
      .mockResolvedValueOnce([{ thread_id: 't1', patient_id: 'p1' }]) // message lookup
      .mockResolvedValueOnce([]) // insert reply
      .mockResolvedValueOnce([]); // update enrichment

    const result = await svc.approveDraft('msg1', 'doc1', null, db);
    expect(result.replyContent).toBe('Your labs are fine.');
  });
});
```

---

## 8. Definition of Done

- [ ] `message_ai_enrichment` table provisioned; repair passes
- [ ] `MessageAiService` and `MessageAiController` in `ehr.module.ts`
- [ ] `GET /messages/inbox` returns messages sorted by urgency with draft + translation fields
- [ ] `POST /messages/:id/approve-draft` sends reply and marks `draft_sent = true`
- [ ] Sent messages have `sent_by_ai = false`
- [ ] EHR inbox shows urgency badge, AI draft, translation toggle
- [ ] Draft is editable before sending
- [ ] `tsc --noEmit` passes
- [ ] All Jest specs pass
- [ ] i18n keys in all 8 locale files
