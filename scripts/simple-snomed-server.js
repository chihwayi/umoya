const express = require('express');
const app = express();
const port = 8082;

app.use(express.json());

// Mock SNOMED concepts for testing
const mockConcepts = {
  "386053000": { conceptId: "386053000", pt: { term: "Evaluation procedure" } },
  "363787002": { conceptId: "363787002", pt: { term: "Observable entity" } },
  "404684003": { conceptId: "404684003", pt: { term: "Clinical finding" } },
  "71388002": { conceptId: "71388002", pt: { term: "Procedure" } },
  "272379006": { conceptId: "272379006", pt: { term: "Event" } },
  "410607006": { conceptId: "410607006", pt: { term: "Organism" } },
  "78621006": { conceptId: "78621006", pt: { term: "Physical force" } },
  "123037004": { conceptId: "123037004", pt: { term: "Body structure" } },
  "105590001": { conceptId: "105590001", pt: { term: "Substance" } },
  "260787004": { conceptId: "260787004", pt: { term: "Physical object" } },
  "48176007": { conceptId: "48176007", pt: { term: "Social context" } },
  "243796009": { conceptId: "243796009", pt: { term: "Situation with explicit context" } },
  "370115009": { conceptId: "370115009", pt: { term: "Special concept" } },
  "308916002": { conceptId: "308916002", pt: { term: "Environment or geographical location" } },
  "419891008": { conceptId: "419891008", pt: { term: "Record artifact" } },
  "27113001": { conceptId: "27113001", pt: { term: "Body weight" } },
  "271649006": { conceptId: "271649006", pt: { term: "Systolic blood pressure" } },
  "271650006": { conceptId: "271650006", pt: { term: "Diastolic blood pressure" } },
  "78564009": { conceptId: "78564009", pt: { term: "Pulse rate" } },
  "386725007": { conceptId: "386725007", pt: { term: "Body temperature" } },
  "86290005": { conceptId: "86290005", pt: { term: "Respiratory rate" } }
};

// Version endpoint
app.get('/version', (req, res) => {
  res.json({ version: "Mock-1.0.0", time: new Date().toISOString() });
});

// Browser concepts endpoint
app.get('/browser/:branch/concepts', (req, res) => {
  const term = req.query.term?.toLowerCase() || '';
  const limit = parseInt(req.query.limit) || 50;
  
  const results = Object.values(mockConcepts)
    .filter(concept => concept.pt.term.toLowerCase().includes(term))
    .slice(0, limit);
  
  res.json({
    items: results,
    total: results.length
  });
});

// Concept details endpoint
app.get('/browser/:branch/concepts/:conceptId', (req, res) => {
  const concept = mockConcepts[req.params.conceptId];
  if (concept) {
    res.json(concept);
  } else {
    res.status(404).json({ error: "Concept not found" });
  }
});

// Code systems endpoint
app.get('/codesystems', (req, res) => {
  res.json({
    items: [
      { shortName: "SNOMEDCT", name: "SNOMED CT International Edition" }
    ]
  });
});

app.listen(port, () => {
  console.log(`Mock SNOMED server running on port ${port}`);
});
