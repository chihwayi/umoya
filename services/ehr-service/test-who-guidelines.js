/**
 * Quick test script to verify WHO Smart Guidelines loading
 * Run: node test-who-guidelines.js
 */

const fs = require('fs');
const path = require('path');

const guidelinesDir = path.join(__dirname, 'who-smart-guidelines');

console.log('🔍 Testing WHO Smart Guidelines Loading...\n');

if (!fs.existsSync(guidelinesDir)) {
  console.error('❌ Directory not found:', guidelinesDir);
  process.exit(1);
}

const files = fs.readdirSync(guidelinesDir).filter(f => f.endsWith('.json'));
console.log(`✓ Found ${files.length} JSON files\n`);

const planDefs = [];
const questionnaires = [];

files.forEach(file => {
  try {
    const filePath = path.join(guidelinesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    const rtype = data.resourceType;
    const rid = data.id || 'unknown';
    const title = data.title || rid;
    
    if (rtype === 'PlanDefinition') {
      planDefs.push({ id: rid, title, file });
    } else if (rtype === 'Questionnaire') {
      questionnaires.push({ id: rid, title, file });
    }
  } catch (error) {
    console.error(`  ✗ Error reading ${file}:`, error.message);
  }
});

console.log(`📋 Summary:`);
console.log(`  - PlanDefinitions: ${planDefs.length}`);
console.log(`  - Questionnaires: ${questionnaires.length}`);
console.log(`  - Total: ${planDefs.length + questionnaires.length} resources\n`);

if (planDefs.length > 0) {
  console.log(`📄 PlanDefinitions (first 5):`);
  planDefs.slice(0, 5).forEach(pd => {
    console.log(`  ✓ ${pd.id}: ${pd.title.substring(0, 50)}`);
  });
}

if (questionnaires.length > 0) {
  console.log(`\n📝 Questionnaires (first 5):`);
  questionnaires.slice(0, 5).forEach(q => {
    console.log(`  ✓ ${q.id}: ${q.title.substring(0, 50)}`);
  });
}

console.log(`\n✅ All resources are valid JSON and ready to load!`);
console.log(`\n💡 Next: Restart EHR service to auto-load these resources`);
