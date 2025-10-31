import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ehrApi } from '../services/api';
import { 
  Users, Calendar, FileText, Activity, ChevronRight, ArrowLeft, Search
} from 'lucide-react';

interface Appointment {
  id: string;
  patient: { id: string; firstName: string; lastName: string; patientNumber: string };
  doctor: { id: string; firstName: string; lastName: string };
  appointmentDate: string;
  appointmentType: string;
  status: string;
  reason: string;
  notes: string;
}

const DoctorTreatmentHistory: React.FC = () => {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('ehr_token') || '';
        const userData = localStorage.getItem('ehr_user');
        const currentUser = userData ? JSON.parse(userData) : null;
        if (!token || !currentUser) return;
        // Fetch all appointments, filter by current doctor and completed
        const resp = await ehrApi.getAppointments(token, tenantSlug as string);
        const all = resp.data.appointments || [];
        const list = all.filter((a: Appointment) => a.doctor.id === currentUser.id && a.status === 'completed');
        setAppointments(list);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tenantSlug]);

  const patients = useMemo(() => {
    const map = new Map<string, { id: string; name: string; number: string; visits: Appointment[] }>();
    appointments.forEach(a => {
      const id = a.patient.id;
      const name = `${a.patient.firstName} ${a.patient.lastName}`;
      const number = a.patient.patientNumber;
      if (!map.has(id)) map.set(id, { id, name, number, visits: [] });
      map.get(id)!.visits.push(a);
    });
    let list = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.number.toLowerCase().includes(q));
    }
    return list;
  }, [appointments, search]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
              <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl"><FileText className="w-6 h-6 text-white" /></div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Treatment History</h1>
                <p className="text-sm text-slate-600">All patients you have treated</p>
              </div>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search by name or ID" className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <Activity className="w-10 h-10 text-slate-400 animate-spin mx-auto mb-4" />
              <p className="text-slate-500">Loading treatment history...</p>
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">No completed treatments yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {patients.map(p => (
                <div key={p.id} className="p-4 bg-gradient-to-br from-white to-slate-50 backdrop-blur-sm rounded-xl border border-slate-200/60 hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-semibold">
                        {p.name.split(' ').map(s=>s[0]).join('').slice(0,2)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-600">ID: {p.number} • Visits: {p.visits.length}</div>
                      </div>
                    </div>
                    <button onClick={() => navigate(`/ehr/${tenantSlug}/doctor/treatments/${p.id}`)} className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2 text-sm shadow">
                      View History <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    {p.visits.slice(0,3).map(v => (
                      <div key={v.id} className="p-3 bg-white rounded-lg border border-slate-200 flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-slate-600" />
                        <div>
                          <div className="font-medium text-slate-900">{new Date(v.appointmentDate).toLocaleDateString()} • {v.appointmentType}</div>
                          <div className="text-xs text-slate-600 line-clamp-1">{v.reason}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorTreatmentHistory;


