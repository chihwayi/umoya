#!/bin/bash

# Real-time monitor for SNOMED CT import progress

echo "🔍 Monitoring SNOMED CT Import Progress"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop monitoring"
echo ""
echo "Looking for import activity..."
echo ""

# Watch for import-related log messages
docker compose logs -f snowstorm 2>/dev/null | grep --line-buffered -i "import\|snapshot\|reading\|concepts read\|relationships read\|descriptions read\|completed.*import" | while read line; do
  # Color code different types of messages
  if echo "$line" | grep -qi "starting"; then
    echo "🟢 $line"
  elif echo "$line" | grep -qi "reading"; then
    echo "📖 $line"
  elif echo "$line" | grep -qi "concepts read\|relationships read\|descriptions read"; then
    echo "📊 $line"
  elif echo "$line" | grep -qi "completed"; then
    echo "✅ $line"
    echo ""
    echo "🎉 Import completed! Testing search..."
    sleep 2
    curl -s "http://localhost:8080/browser/MAIN/concepts?term=pain&limit=1" | jq '.items[0] | {conceptId, term: .pt.term}' 2>/dev/null
    echo ""
    echo "If you see a real concept ID (not null), the import was successful!"
    break
  else
    echo "ℹ️  $line"
  fi
done




