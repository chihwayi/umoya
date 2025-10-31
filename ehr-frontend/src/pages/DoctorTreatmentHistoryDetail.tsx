import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ehrApi } from '../services/api';
import {
  ArrowLeft, Calendar, FileText, Activity, Pill, TestTube, Heart, Thermometer, Droplets,
  Clock, User as UserIcon, CheckCircle, AlertCircle
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

export default function DoctorTreatmentHistoryDetail() {
  const { tenantSlug, patientId } = useParams();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [authorizedOrders, setAuthorizedOrders] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('ehr_token') || '';
        const userData = localStorage.getItem('ehr_user');
        const currentUser = userData ? JSON.parse(userData) : null;
        if (!token || !currentUser || !patientId) return;

        // Appointments (completed, this doctor, this patient)
        const resp = await ehrApi.getAppointments(token, tenantSlug as string);
        const all = resp.data.appointments || [];
        const appts = all.filter((a: Appointment) => a.patient.id === patientId && a.doctor.id === currentUser.id);
        appts.sort((a: Appointment, b: Appointment) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime());
        setAppointments(appts);

        // Orders (authorized) - filter by patient
        try {
          const ord = await ehrApi.getAuthorizedOrders(token, tenantSlug as string);
          setAuthorizedOrders((ord.data.orders || []).filter((o: any) => o.patientId === patientId));
        } catch {}

        // Prescriptions
        try {
          const rx = await ehrApi.getPatientPrescriptions(patientId, token, tenantSlug as string);
          setPrescriptions(rx.data || []);
        } catch {}

        // Vitals
        try {
          const vs = await ehrApi.getVitals(patientId, token, tenantSlug as string);
          setVitals(vs.data.vitals || []);
        } catch {}
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tenantSlug, patientId]);

  const patientInfo = useMemo(() => {
    if (appointments.length > 0) {
      const p = appointments[0].patient;
      return { name: `${p.firstName} ${p.lastName}`, number: p.patientNumber };
    }
    return { name: '', number: '' };
  }, [appointments]);

  const timeline = useMemo(() => {
    const items: Array<{ date: string; type: string; title: string; description?: string; meta?: any }>= [];
    appointments.forEach(a => {
      items.push({ date: a.appointmentDate, type: 'appointment', title: `${a.appointmentType}`, description: a.reason, meta: { status: a.status } });
      // Parse notes JSON if present
      if (a.notes) {
        try {
          const parsed = JSON.parse(a.notes);
          if (parsed.clinicalDocumentation) {
            items.push({ date: a.appointmentDate, type: 'notes', title: 'Clinical Documentation', description: parsed.clinicalDocumentation.clinicalAssessment || parsed.notes });
          }
          if (parsed.prescriptions && Array.isArray(parsed.prescriptions)) {
            parsed.prescriptions.forEach((rx: any) => {
              items.push({ date: rx.at || a.appointmentDate, type: 'prescription', title: `Prescription • ${rx.name}`, description: `Dosage: ${rx.dosage}, Freq: ${rx.frequency}, Dur: ${rx.duration}` });
            });
          }
          if (parsed.labOrders && Array.isArray(parsed.labOrders)) {
            parsed.labOrders.forEach((lo: any) => {
              items.push({ date: lo.at || a.appointmentDate, type: 'lab', title: `Lab Order • ${lo.testName}`, description: lo.instructions });
            });
          }
        } catch {}
      }
    });
    authorizedOrders.forEach(o => {
      items.push({ date: o.authorizedAt || o.createdAt, type: o.orderType === 'medication' ? 'prescription' : (o.orderType === 'lab_test' ? 'lab' : 'order'), title: `${o.orderType === 'lab_test' ? 'Lab' : 'Order'} • ${o.orderName}`, description: o.instructions });
    });
    vitals.forEach((v: any) => {
      items.push({ date: v.recordedAt, type: 'vitals', title: `Vitals • BP ${v.bloodPressure || '—'}`, description: `HR ${v.heartRate ?? '—'}, Temp ${v.temperature ?? '—'}°C, SpO2 ${v.oxygenSaturation ?? '—'}%` });
    });
    // Sort by date desc
    items.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [appointments, authorizedOrders, vitals]);

  const renderIcon = (type: string) => {
    switch (type) {
      case 'appointment': return <Calendar className="w-4 h-4 text-slate-600" />;
      case 'notes': return <FileText className="w-4 h-4 text-indigo-600" />;
      case 'prescription': return <Pill className="w-4 h-4 text-pink-600" />;
      case 'lab': return <TestTube className="w-4 h-4 text-violet-600" />;
      case 'vitals': return <Activity className="w-4 h-4 text-emerald-600" />;
      default: return <CheckCircle className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Treatment Timeline</h1>
                <p className="text-sm text-slate-600">{patientInfo.name} • ID: {patientInfo.number}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <Activity className="w-10 h-10 text-slate-400 animate-spin mx-auto mb-4" />
              <p className="text-slate-500">Loading timeline...</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-200 via-slate-200 to-transparent" />
              <div className="space-y-4">
                {timeline.map((item, idx) => (
                  <div key={idx} className="pl-10">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                        {renderIcon(item.type)}
                      </div>
                      <div className="flex-1 p-4 bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200/60 hover:shadow-sm transition">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-semibold text-slate-900">{item.title}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(item.date).toLocaleString()}</div>
                        </div>
                        {item.description && (
                          <div className="text-sm text-slate-700">{item.description}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {timeline.length === 0 && (
                  <div className="text-center py-12">
                    <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-500">No events to display yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


