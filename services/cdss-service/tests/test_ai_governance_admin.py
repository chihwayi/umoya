import asyncio
from unittest.mock import MagicMock

import main


def test_admin_ai_vendors_and_usecases_direct_calls():
    original = main.settings_provider
    mock = MagicMock()
    mock.get_ai_vendor_registry.return_value = [
        {"vendor_id": "ollama", "provider": "ollama", "status": "active", "config": {}}
    ]
    mock.get_ai_usecase_policies.return_value = [
        {"use_case": "patient_summarization", "policy": {"enabled": True}}
    ]
    mock.upsert_ai_vendor_entry.side_effect = lambda actor, entry: entry
    mock.upsert_ai_usecase_policy.side_effect = lambda actor, use_case, policy: policy
    main.settings_provider = mock

    try:
        vendors = asyncio.run(main.admin_ai_vendors(owner="owner"))
        assert vendors["vendors"][0]["vendor_id"] == "ollama"

        vendor_payload = main.AiVendorRegistryEntryPayload(
            vendor_id="ollama",
            provider="ollama",
            display_name="Local Ollama",
            status="active",
            config={"required_env": ["LLM_API_URL", "LLM_MODEL_NAME"]},
        )
        vendor_saved = asyncio.run(main.admin_ai_vendors_upsert(vendor_payload, owner="owner"))
        assert vendor_saved["ok"] is True
        assert vendor_saved["vendor"]["vendor_id"] == "ollama"

        usecases = asyncio.run(main.admin_ai_usecases(owner="owner"))
        assert usecases["usecases"][0]["use_case"] == "patient_summarization"

        usecase_payload = main.AiUseCasePolicyPayload(
            use_case="patient_summarization",
            enabled=True,
            vendor_id="ollama",
            allowed_model_names=["medicore-llm"],
            require_tenant_context=True,
            redaction_required=True,
        )
        usecase_saved = asyncio.run(main.admin_ai_usecases_upsert(usecase_payload, owner="owner"))
        assert usecase_saved["ok"] is True
        assert usecase_saved["use_case"] == "patient_summarization"
        assert usecase_saved["policy"]["vendor_id"] == "ollama"
    finally:
        main.settings_provider = original
