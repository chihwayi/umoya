# 📋 Phase 2 - Apply ALL Migrations to Database

**Target Database:** tenant_bulawayo_general  
**Sprints:** 30-33 (4 sprints)

---

## 🚀 Quick Apply (All at Once)

```bash
cd /Users/devoop/Dev/personal/medicore

# Sprint 32: CDI
bash scripts/apply-sprint32-migration.sh

# Sprint 33: Case Management
bash scripts/apply-sprint33-migration.sh
```

---

## ✅ Manual Verification

```bash
# Check all Phase 2 tables
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT 'Sprint 30: Infection Control' as sprint, COUNT(*) as tables
FROM information_schema.tables 
WHERE table_name IN ('infection_surveillance', 'isolation_precautions', 'antimicrobial_stewardship', 'outbreak_alerts', 'hand_hygiene_compliance')
UNION ALL
SELECT 'Sprint 31: Revenue Cycle', COUNT(*)
FROM information_schema.tables 
WHERE table_name IN ('charge_master', 'patient_charges', 'drg_assignments', 'missed_charges', 'charge_capture_rules')
UNION ALL
SELECT 'Sprint 32: CDI', COUNT(*)
FROM information_schema.tables 
WHERE table_name IN ('cdi_reviews', 'physician_queries', 'documentation_completeness', 'cdi_opportunities')
UNION ALL
SELECT 'Sprint 33: Case Management', COUNT(*)
FROM information_schema.tables 
WHERE table_name IN ('case_management_assessments', 'discharge_plans', 'utilization_reviews');
"
```

**Expected Results:**
- Sprint 30: 5-6 tables
- Sprint 31: 5 tables
- Sprint 32: 4 tables
- Sprint 33: 3 tables

**Total:** 17-18 new tables in Phase 2

---

## 📊 Complete Table Count

```bash
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public';"
```

**Expected:** ~80+ tables (existing + Phase 1 + Phase 2)

---

## 🎯 Current Status

**Phase 1:** ✅ 22 tables applied  
**Phase 2 Sprint 30:** ✅ Applied (from your run)  
**Phase 2 Sprint 31:** ✅ Applied (from your run)  
**Phase 2 Sprint 32:** ⏳ Run script above  
**Phase 2 Sprint 33:** ⏳ Run script above

---

**After running these, all migrations will be in tenant_bulawayo_general!** ✅




