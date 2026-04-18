import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ntdApi } from '../../services/api';
import { 
  AlertCircle, 
  RefreshCw, 
  Loader2,
  Stethoscope,
  Activity,
  ShieldCheck,
  Eye,
  Footprints
} from 'lucide-react';

const NtdDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [loading, setLoading] = useState(true);
  const [leprosyCases, setLeprosyCases] = useState([]);
  const [onchoCases, setOnchoCases] = useState([]);
  const [filariasisCases, setFilariasisCases] = useState([]);
  const [activeTab, setActiveTab] = useState<'leprosy' | 'oncho' | 'filariasis'>('leprosy');

  const getToken = () => localStorage.getItem('token') || '';

  const fetchData = async () => {
    const token = getToken();
    if (!token || !tenantSlug) return;
    
    setLoading(true);
    try {
      const [l, o, f] = await Promise.all([
        ntdApi.getLeprosyCases(undefined, token, tenantSlug),
        ntdApi.getOnchocerciasisCases(undefined, token, tenantSlug),
        ntdApi.getFilariasisCases(undefined, token, tenantSlug)
      ]);
      setLeprosyCases(l.data || l);
      setOnchoCases(o.data || o);
      setFilariasisCases(f.data || f);
    } catch (err) {
      console.error('Failed to fetch NTD data', err);
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
          <h2 className="text-xl font-bold text-white">NTD Clinical Depth (S153)</h2>
          <p className="text-sm text-slate-400">Advanced tracking for Leprosy MDT, Onchocerciasis MDA & Filariasis Safety</p>
        </div>
        <button 
          onClick={fetchData}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 flex gap-3 items-start text-blue-200">
        <ShieldCheck className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm">
          <span className="font-bold">Loa loa Safety Protocol:</span> CDSS check enabled for all filariasis treatments. Diethylcarbamazine (DEC) is automatically flagged if Loa loa MF count {'>'} 8000.
        </p>
      </div>

      <div className="flex gap-2 p-1 bg-slate-900/60 border border-slate-800 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('leprosy')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'leprosy' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Leprosy MDT ({leprosyCases.length})
        </button>
        <button
          onClick={() => setActiveTab('oncho')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'oncho' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Onchocerciasis ({onchoCases.length})
        </button>
        <button
          onClick={() => setActiveTab('filariasis')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'filariasis' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Filariasis ({filariasisCases.length})
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
                <th className="px-4 py-3 font-medium">Reg. Date</th>
                <th className="px-4 py-3 font-medium">Patient ID</th>
                <th className="px-4 py-3 font-medium">
                  {activeTab === 'leprosy' ? 'Classification' : (activeTab === 'oncho' ? 'Eye Involvement' : 'Disease Type')}
                </th>
                <th className="px-4 py-3 font-medium">Status/Safe</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {activeTab === 'leprosy' && leprosyCases.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-300">{c.registrationDate}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{c.patientId}</td>
                  <td className="px-4 py-3 text-slate-300">
                    <span className="font-bold">{c.classification}</span>
                    {c.ridleyJoplingType && <span className="text-slate-500 ml-2">({c.ridleyJoplingType})</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      c.outcome === 'completed_treatment' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      {c.outcome ? c.outcome.toUpperCase() : 'UNDER TREATMENT'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-blue-400 hover:underline">View MDT Card</button>
                  </td>
                </tr>
              ))}

              {activeTab === 'oncho' && onchoCases.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-300">{c.registrationDate}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{c.patientId}</td>
                  <td className="px-4 py-3 text-slate-300 text-center">
                    {c.ocularInvolvement ? (
                      <div className="flex justify-center"><Eye className="w-4 h-4 text-red-400" /></div>
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-400">MDA Round {c.mdaRound || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-blue-400 hover:underline">View Clinical</button>
                  </td>
                </tr>
              ))}

              {activeTab === 'filariasis' && filariasisCases.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-300">{c.registrationDate}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{c.patientId}</td>
                  <td className="px-4 py-3 text-slate-300 capitalize">
                    {c.diseaseType.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3">
                    {c.treatmentSafe === false ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 w-fit">
                        <AlertCircle className="w-3 h-3" /> UNSAFE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                        SAFE
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-blue-400 hover:underline">Safety Details</button>
                  </td>
                </tr>
              ))}

              {((activeTab === 'leprosy' && leprosyCases.length === 0) || 
                (activeTab === 'oncho' && onchoCases.length === 0) || 
                (activeTab === 'filariasis' && filariasisCases.length === 0)) && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500 italic">
                    No clinical records for this NTD program in current district.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeatureCard 
          title="Disability Grade" 
          icon={<Footprints className="w-5 h-5" />} 
          description="WHO 0/1/2 grading logic for eyes, hands, and feet" 
        />
        <FeatureCard 
          title="ESPEN Pipeline" 
          icon={<Activity className="w-5 h-5" />} 
          description="Direct reporting for Onchocerciasis and LF MDA rounds" 
        />
        <FeatureCard 
          title="MDT Compliance" 
          icon={<Stethoscope className="w-5 h-5" />} 
          description="Automated tracking of supervised vs self-dosing" 
        />
      </div>
    </div>
  );
};

const FeatureCard: React.FC<{ title: string, icon: React.ReactNode, description: string }> = ({ title, icon, description }) => (
  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex gap-4 items-center">
    <div className="p-2 bg-slate-800 rounded-lg text-slate-300">{icon}</div>
    <div>
      <h4 className="text-sm font-bold text-white">{title}</h4>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  </div>
);

export default NtdDashboard;
