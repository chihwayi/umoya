# Snowstorm Setup Guide for MediCore

This guide explains how to run a local Snowstorm instance alongside the MediCore stack so the SNOMED CT integration returns real terminology data.

---

## 1. Prerequisites

| Requirement | Details |
|-------------|---------|
| SNOMED CT License | Register at [SNOMED International](https://www.snomed.org/) or your National Release Center. |
| RF2 Release Files | Download the latest SNOMED CT RF2 snapshot ZIP (International edition or your NRC edition). |
| Hardware | ≥ 4 GB RAM available for the Snowstorm container + disk space for the RF2 content (5–10 GB). |

> ⚠️ SNOMED CT content is licensed. Ensure you comply with the SNOMED CT terms and conditions for your country/organization.

---

## 2. Prepare RF2 Files

1. Extract the RF2 ZIP you downloaded.
2. Copy the extracted folders into `./snowstorm/import` within the MediCore repository.  
   The final structure should look similar to:

```
snowstorm/
  import/
    SnomedCT_InternationalRF2_PRODUCTION_20240131T120000Z/
      Snapshot/
        Terminology/
        Refset/
        ...
```

> Do **not** commit the RF2 content to source control. Add `snowstorm/import` to your local `.gitignore` if necessary.

---

## 3. Start Snowstorm

Snowstorm is now defined in `docker-compose.yml`. Start (or restart) MediCore:

```bash
docker-compose up -d snowstorm
docker-compose up -d
```

The Snowstorm container exposes port `8080` to your host and is available to the EHR service via `http://snowstorm:8080`.

---

## 4. Import SNOMED CT Content

Once the container is running, load the RF2 data:

```bash
./scripts/import-snomed-rf2.sh
```

The script triggers an import via the Snowstorm REST API. Monitor the progress:

```bash
docker exec medicore-snowstorm curl -s http://localhost:8080/imports | jq '.'
```

When the status reports `COMPLETED`, terminology data is ready.

---

## 5. Verify Integration

1. Ensure Snowstorm is healthy:
   ```bash
   curl http://localhost:8080/actuator/health
   ```

2. Call MediCore’s SNOMED endpoint:
   ```bash
   curl -H "Authorization: Bearer <token>" \
        -H "X-Tenant-ID: bulawayo-general" \
        "http://localhost:3013/api/terminology/snomed/search?term=diabetes&limit=3"
   ```

3. You should receive live SNOMED CT concept data.

---

## 6. Troubleshooting

| Symptom | Possible Cause | Fix |
|---------|----------------|-----|
| `ECONNREFUSED ::1:8080` from MediCore | Snowstorm not running / wrong URL | Verify `docker ps`, ensure `SNOMED_BASE_URL=http://snowstorm:8080`. |
| Import stuck in `RUNNING` for long time | Large RF2 load | Wait longer (initial import can take 30–60 minutes). |
| No results in search | RF2 import not completed | Check `/imports` API, rerun import script if needed. |
| High memory usage | Snowstorm indexing | Increase Docker memory allocation if necessary. |

---

## 7. Environment Summary

| Service | URL | Notes |
|---------|-----|-------|
| Snowstorm | http://snowstorm:8080 | Internal to Docker network |
| Snowstorm (host) | http://localhost:8080 | Optional host access |
| MediCore SNOMED API | http://localhost:3013/api/terminology/... | Uses Snowstorm automatically |

---

## 8. Next Steps

* Schedule regular RF2 updates (monthly or per NRC release).
* Back up `./snowstorm/data` to retain Snowstorm indices between runs.
* Review SNOMED CT license terms before deploying to production.

Once Snowstorm is populated, the MediCore SNOMED endpoints will deliver real terminology data with no external dependencies. 🎉


