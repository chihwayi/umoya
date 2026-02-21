import unittest
from unittest.mock import MagicMock, patch

import main
from main import TenantAIPolicyPayload


class TestAdminTenantPolicy(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # patch settings_provider with a simple mock
        self.original = main.settings_provider
        mock = MagicMock()
        mock.get_tenant_policy = MagicMock(return_value={})
        mock.upsert_tenant_policy = MagicMock(side_effect=lambda tid, pol: pol)
        main.settings_provider = mock
        self.addAsyncCleanup(self._cleanup)

    async def _cleanup(self):
        main.settings_provider = self.original

    async def test_get_policy_empty(self):
        result = await main.get_tenant_ai_policy("tenantX", owner="owner")
        self.assertEqual(result, {"tenant_id": "tenantX", "policy": {}})
        main.settings_provider.get_tenant_policy.assert_called_with("tenantX")

    async def test_set_policy(self):
        payload = TenantAIPolicyPayload(ai_enabled=False, max_requests_per_minute=10)
        result = await main.set_tenant_ai_policy("tenantY", payload, owner="owner")
        self.assertEqual(result["tenant_id"], "tenantY")
        self.assertEqual(result["policy"], {"ai_enabled": False, "max_requests_per_minute": 10})
        main.settings_provider.upsert_tenant_policy.assert_called_with("tenantY", {"ai_enabled": False, "max_requests_per_minute": 10})


if __name__ == '__main__':
    unittest.main()
