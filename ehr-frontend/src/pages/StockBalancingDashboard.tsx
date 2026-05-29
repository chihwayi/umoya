import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface StockLevel {
  facilitySubdomain: string;
  itemCode: string;
  itemName: string;
  category: string;
  currentStock: number;
  minStockLevel: number;
  isShortage: boolean;
  isSurplus: boolean;
}

interface Recommendation {
  itemCode: string;
  itemName: string;
  surplusFacility: string;
  shortageFacility: string;
  recommendedTransferQty: number;
  urgency: string;
}

const URGENCY_CLASSES: Record<string, string> = {
  high:   'text-red-700 bg-red-100',
  medium: 'text-amber-700 bg-amber-100',
  low:    'text-gray-600 bg-gray-100',
};

export default function StockBalancingDashboard() {
  const [levels, setLevels] = useState<StockLevel[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/network/stock/levels').then((r: any) => setLevels(r.data ?? r)),
      api.get('/network/stock/recommendations').then((r: any) => setRecs(r.data ?? r)),
    ]).finally(() => setLoading(false));
  }, []);

  const shortages = levels.filter((l) => l.isShortage);
  const surpluses  = levels.filter((l) => l.isSurplus);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Cross-Facility Stock Balancing</h2>

      {/* Recommendations */}
      {recs.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-700 mb-2">Rebalancing Recommendations ({recs.length})</h3>
          <div className="flex flex-col gap-2">
            {recs.map((r, i) => (
              <div key={i} className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-gray-800">{r.itemName}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Move {r.recommendedTransferQty} units: <strong>{r.surplusFacility}</strong> → <strong>{r.shortageFacility}</strong>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${URGENCY_CLASSES[r.urgency] ?? 'bg-gray-100'}`}>
                  {r.urgency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Shortages */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">
            Shortages <span className="text-red-600">({shortages.length})</span>
          </h3>
          <table className="w-full text-xs">
            <thead><tr className="text-gray-400 border-b"><th className="text-left pb-1">Item</th><th className="text-left pb-1">Facility</th><th className="pb-1">Stock</th><th className="pb-1">Min</th></tr></thead>
            <tbody>
              {shortages.slice(0, 15).map((l, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1">{l.itemName}</td>
                  <td className="py-1 text-gray-500">{l.facilitySubdomain}</td>
                  <td className="py-1 text-center text-red-600 font-semibold">{l.currentStock}</td>
                  <td className="py-1 text-center text-gray-400">{l.minStockLevel}</td>
                </tr>
              ))}
              {shortages.length === 0 && <tr><td colSpan={4} className="text-gray-400 py-3 text-center">No shortages</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Surpluses */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">
            Surpluses <span className="text-green-600">({surpluses.length})</span>
          </h3>
          <table className="w-full text-xs">
            <thead><tr className="text-gray-400 border-b"><th className="text-left pb-1">Item</th><th className="text-left pb-1">Facility</th><th className="pb-1">Stock</th></tr></thead>
            <tbody>
              {surpluses.slice(0, 15).map((l, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1">{l.itemName}</td>
                  <td className="py-1 text-gray-500">{l.facilitySubdomain}</td>
                  <td className="py-1 text-center text-green-600 font-semibold">{l.currentStock}</td>
                </tr>
              ))}
              {surpluses.length === 0 && <tr><td colSpan={3} className="text-gray-400 py-3 text-center">No surpluses</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
