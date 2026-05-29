import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../services/api';

interface QueueEntry {
  id: string;
  first_name: string;
  last_name: string;
  mrn: string;
  appointment_time: string;
  visit_type: string;
  status: string;
  wait_minutes: number;
}

export default function NurseCheckinDashboard() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [scannedPatient, setScannedPatient] = useState<any>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 30_000);

    scannerRef.current = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false);
    scannerRef.current.render(onScanSuccess, () => {});

    return () => {
      clearInterval(interval);
      scannerRef.current?.clear();
    };
  }, []);

  async function loadQueue() {
    const { data } = await api.get('/checkin/queue');
    setQueue(data);
  }

  async function onScanSuccess(rawToken: string) {
    try {
      const { data } = await api.post('/checkin/scan', { token: rawToken });
      setScannedPatient(data.patient);
      loadQueue();
      window.location.href = `/patients/${data.patientId}`;
    } catch {
      alert('Invalid or expired QR code');
    }
  }

  const checkedInCount = queue.filter((q) => q.status === 'checked_in').length;

  return (
    <div className="grid grid-cols-2 gap-6 p-6">
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Scan Patient QR Code</h2>
        <div id="qr-reader" className="w-full" />
        {scannedPatient && (
          <div className="mt-3 p-3 bg-green-50 border border-green-300 rounded text-sm text-green-800">
            ✓ Checked in: {scannedPatient.first_name} {scannedPatient.last_name} (MRN {scannedPatient.mrn})
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-bold text-gray-800 mb-3">
          Today's Queue ({checkedInCount} checked in)
        </h2>
        <div className="divide-y">
          {queue.map((entry) => (
            <div key={entry.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800 text-sm">
                  {entry.first_name} {entry.last_name}
                </div>
                <div className="text-xs text-gray-500">
                  MRN {entry.mrn} · {entry.visit_type} · {entry.appointment_time}
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    entry.status === 'checked_in'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {entry.status === 'checked_in'
                    ? `Wait: ${Math.round(entry.wait_minutes)}m`
                    : 'Expected'}
                </span>
              </div>
            </div>
          ))}
          {queue.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No patients yet today</p>
          )}
        </div>
      </div>
    </div>
  );
}
