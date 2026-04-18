import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { outbreakApi } from '../../services/api';
import { 
  AlertTriangle, 
  RefreshCw, 
  Search, 
  Loader2,
  ClipboardList,
  ShieldCheck,
  Microscope
} from 'lucide-react';

const OutbreakProtocolDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [loading, setLoading] = useState(true);
  const [plagueCases, setPlagueCases] = useState([]);
  const [yfCases, setYfCases] = useState([]);
  const [meningitisCases, setMeningitisCases] = useState([]);
  const [activeDisease, setActiveDisease] = useState<'plague' | 'yf' | 'meningitis'>('plague');

  const getToken = () => localStorage.getItem('token') || '';

  const fetchData = async () => {
    const token = getToken();
    if (!token || !tenantSlug) return;
    
    setLoading(true);
    try {
      const [p, y, m] = await Promise.all([
        outbreakApi.getPlagueCases(undefined, token, tenantSlug),
        outbreakApi.getYellowFeverCases(undefined, token, tenantSlug),
        outbreakApi.getMeningitisCases(undefined, token, tenantSlug)
      ]);
      setPlagueCases(p.data || p);
      setYfCases(y.data || y);
      setMeningitisCases(m.data || m);
    } catch (err) {
      console.error('Failed to fetch outbreak data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantSlug]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Advanced Disease Protocols</h2>
          <p className="text-sm text-slate-400">Specialized tracking for Plague, Yellow Fever, and Meningitis</p>
        </div>
        <button 
          onClick={fetchData}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-4 flex gap-3 items-start text-amber-200">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm">
          <span className="font-bold">Protocol Alert:</span> Clinical depth expanded for S151. Ensure all bubonic/pneumonic flags are recorded accurately for CDSS precision.
        </p>
      </div>

      <div className="flex gap-2 p-1 bg-slate-900/60 border border-slate-800 rounded-lg w-fit">
        <button
          onClick={() => setActiveDisease('plague')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeDisease === 'plague' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Plague ({plagueCases.length})
        </button>
        <button
          onClick={() => setActiveDisease('yf')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeDisease === 'yf' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Yellow Fever ({yfCases.length})
        </button>
        <button
          onClick={() => setActiveDisease('meningitis')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeDisease === 'meningitis' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Meningitis ({meningitisCases.length})
        </button>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Date Reported</th>
                <th className="px-4 py-3 font-medium">Patient ID</th>
                <th className="px-4 py-3 font-medium">{activeDisease === 'plague' ? 'Form' : (activeDisease === 'yf' ? 'Phase' : 'Pathogen')}</th>
                <th className="px-4 py-3 font-medium">Classification</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {activeDisease === 'plague' && plagueCases.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-300">{c.dateReported}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{c.patientId}</td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{c.form}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      c.classification === 'confirmed' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {c.classification.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-blue-400 hover:underline">View Case</button>
                  </td>
                </tr>
              ))}
              
              {activeDisease === 'yf' && yfCases.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-300">{c.dateReported}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{c.patientId}</td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{c.phase}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      c.classification === 'confirmed' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {c.classification.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-blue-400 hover:underline">View Case</button>
                  </td>
                </tr>
              ))}

              {activeDisease === 'meningitis' && meningitisCases.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-300">{c.dateReported}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{c.patientId}</td>
                  <td className="px-4 py-3 text-slate-300">{c.pathogenSuspected}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      c.classification === 'confirmed' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {c.classification.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-blue-400 hover:underline">View Case</button>
                  </td>
                </tr>
              ))}

              {((activeDisease === 'plague' && plagueCases.length === 0) || 
                (activeDisease === 'yf' && yfCases.length === 0) || 
                (activeDisease === 'meningitis' && meningitisCases.length === 0)) && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500 italic">
                    No cases reported for this protocol in the current period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Case Management" icon={<ClipboardList className="w-5 h-5" />} description="WHO 2021 Plague guidelines integrated" />
        <Card title="Lab Integration" icon={<Microscope className="w-5 h-5" />} description="Direct linking of CSF and Blood cultures" />
        <Card title="Notifiable Actions" icon={<ShieldCheck className="w-5 h-5" />} description="Automatic WHO event trigger mapping" />
      </div>
    </div>
  );
};

const Card: React.FC<{ title: string, icon: React.ReactNode, description: string }> = ({ title, icon, description }) => (
  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex gap-4 items-center">
    <div className="p-2 bg-slate-800 rounded-lg text-slate-300">{icon}</div>
    <div>
      <h4 className="text-sm font-bold text-white">{title}</h4>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  </div>
);

export default OutbreakProtocolDashboard;
