# Voice Consultation Integration Example

## How to Integrate Voice Consultation into ClinicalNotesScreen

### Step 1: Import the Components

```typescript
import VoiceConsultationButton from '../../components/voice/VoiceConsultationButton';
import medicalEntityExtractor, { ExtractedEntities } from '../../services/medical-entity-extractor.service';
```

### Step 2: Add State for Extracted Data

```typescript
const [extractedEntities, setExtractedEntities] = useState<ExtractedEntities | null>(null);
```

### Step 3: Add the Voice Button to Your UI

Place it near the form fields, for example:

```tsx
<View style={styles.voiceSection}>
  <VoiceConsultationButton
    patientName={patient?.firstName + ' ' + patient?.lastName}
    patientId={patientId}
    language="auto" // or 'en', 'sn', 'nd'
    onTranscriptionComplete={(text, entities) => {
      // Auto-populate form fields
      if (entities.chiefComplaint) {
        setChiefComplaint(entities.chiefComplaint);
      }
      if (entities.vitals) {
        // You can show a modal to confirm vitals
        // or auto-populate if you have a vitals form
      }
      if (entities.symptoms && entities.symptoms.length > 0) {
        setHistoryOfPresentIllness(
          entities.symptoms.join(', ')
        );
      }
      if (entities.notes) {
        setAdditionalNotes(entities.notes);
      }
      
      setExtractedEntities(entities);
      
      Alert.alert(
        'Voice Transcription Complete',
        `Extracted ${Object.keys(entities.vitals || {}).length} vitals and ${entities.symptoms?.length || 0} symptoms. Please review and confirm.`,
        [{ text: 'OK' }]
      );
    }}
    onError={(error) => {
      Alert.alert('Error', error);
    }}
  />
</View>
```

### Step 4: Add Styles

```typescript
const styles = StyleSheet.create({
  // ... existing styles
  voiceSection: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
});
```

## Integration into VisitManagementScreen

For quick vitals capture:

```tsx
<View style={styles.quickVitalsSection}>
  <VoiceConsultationButton
    patientName={appointment?.patient?.firstName + ' ' + appointment?.patient?.lastName}
    patientId={appointment?.patient?.id}
    size="small"
    onTranscriptionComplete={(text, entities) => {
      if (entities.vitals) {
        // Show confirmation modal for vitals
        Alert.alert(
          'Extracted Vitals',
          `BP: ${entities.vitals.bloodPressureSystolic || '--'}/${entities.vitals.bloodPressureDiastolic || '--'}\n` +
          `Temp: ${entities.vitals.temperature || '--'}°C\n` +
          `HR: ${entities.vitals.heartRate || '--'} bpm\n\n` +
          'Would you like to save these vitals?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Save',
              onPress: async () => {
                // Save vitals using vitalsService
                await vitalsService.recordVitals(appointment.patient.id, entities.vitals);
                // Reload vitals
                loadPatientData();
              },
            },
          ]
        );
      }
    }}
  />
</View>
```

## Backend Endpoint Required

You'll need to create a backend endpoint for Whisper transcription:

### Example NestJS Controller:

```typescript
@Post('transcription/whisper')
@UseInterceptors(FileInterceptor('audio'))
async transcribeWithWhisper(
  @UploadedFile() file: Express.Multer.File,
  @Body() body: { language?: string; temperature?: string; prompt?: string },
) {
  // Use OpenAI Whisper API or self-hosted Whisper
  // Return transcription result
}
```

## Package Installation

```bash
cd mobile-app
npm install react-native-audio-recorder-player react-native-permissions
npm install --save-dev @types/react-native-audio-recorder-player

# For iOS
cd ios && pod install && cd ..
```

## Android Permissions

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

## iOS Permissions

Add to `ios/Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Medicore needs access to your microphone to record consultations for accurate documentation.</string>
```

## Testing

1. Test consent flow
2. Test recording start/stop
3. Test transcription (with sample audio)
4. Test entity extraction
5. Test auto-population
6. Test with Shona/Ndebele/English

## Notes

- Keep the UI simple and non-intrusive
- Always allow manual override
- Show extracted data for review before saving
- Handle errors gracefully
- Respect patient consent
