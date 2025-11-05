import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, Download, X } from 'lucide-react';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

interface HIVPatientSummaryCardProps {
  enrollment: any;
  patientDetails: any;
  clinicalVisits: any[];
  onClose: () => void;
}

const HIVPatientSummaryCard: React.FC<HIVPatientSummaryCardProps> = ({
  enrollment,
  patientDetails,
  clinicalVisits,
  onClose
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    pageStyle: `
      @page {
        size: A4;
        margin: 0.5cm;
      }
      @media print {
        .no-print {
          display: none !important;
        }
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `,
    documentTitle: `HIV_Patient_Card_${enrollment.enrollment_number}`
  });

  const latestVisit = clinicalVisits.length > 0 ? clinicalVisits[0] : null;
  const calculateAge = (dob: string) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = patientDetails?.dateOfBirth ? calculateAge(patientDetails.dateOfBirth) : 'N/A';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 flex items-center justify-between no-print">
          <h2 className="text-xl font-bold">Patient Summary Card</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="bg-white text-emerald-600 px-4 py-2 rounded-lg hover:bg-emerald-50 flex items-center gap-2 font-semibold"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={onClose}
              className="bg-white text-emerald-600 px-4 py-2 rounded-lg hover:bg-emerald-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div ref={printRef} className="p-6 overflow-y-auto">
          {/* Wallet Card (Small) */}
          <div className="border-2 border-slate-300 rounded-lg p-4 mb-6 bg-gradient-to-br from-white to-slate-50" style={{ width: '85.6mm', height: '53.98mm' }}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-xs text-slate-600">HIV Care Enrollment</p>
                <p className="text-sm font-bold text-slate-900">{enrollment.enrollment_number}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-600">Patient ID</p>
                <p className="text-sm font-bold text-slate-900">{patientDetails?.patientNumber || enrollment.patient_number}</p>
              </div>
            </div>
            <div className="mb-2">
              <p className="text-xs font-semibold text-slate-900">
                {enrollment.first_name} {enrollment.last_name}
              </p>
              <p className="text-xs text-slate-600">{age} years, {patientDetails?.gender || enrollment.gender}</p>
            </div>
            {latestVisit && (
              <div className="border-t border-slate-300 pt-2 mt-2">
                <p className="text-xs text-slate-600">Current Regimen</p>
                <p className="text-xs font-semibold text-slate-900">{latestVisit.arv_regimen_name || 'N/A'}</p>
                <p className="text-xs text-slate-600 mt-1">Last Visit: {latestVisit.visit_date ? formatDateToDDMMYYYY(latestVisit.visit_date) : 'N/A'}</p>
              </div>
            )}
          </div>

          {/* Full Summary Card */}
          <div className="border-2 border-slate-300 rounded-lg p-6 bg-white">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">HIV Care Patient Summary</h3>
              <p className="text-sm text-slate-600">Facility: {enrollment.enrollment_facility || 'N/A'}</p>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Patient Information */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-bold text-slate-900 mb-3 text-sm">Patient Information</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-slate-600">Name: </span>
                    <span className="font-semibold">{enrollment.first_name} {enrollment.last_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Patient ID: </span>
                    <span className="font-semibold">{patientDetails?.patientNumber || enrollment.patient_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Date of Birth: </span>
                    <span className="font-semibold">
                      {patientDetails?.dateOfBirth ? formatDateToDDMMYYYY(patientDetails.dateOfBirth) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">Age: </span>
                    <span className="font-semibold">{age} years</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Gender: </span>
                    <span className="font-semibold">{patientDetails?.gender || enrollment.gender || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Phone: </span>
                    <span className="font-semibold">{patientDetails?.phone || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Enrollment Information */}
              <div className="bg-emerald-50 rounded-lg p-4">
                <h4 className="font-bold text-slate-900 mb-3 text-sm">Enrollment Information</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-slate-600">Enrollment Number: </span>
                    <span className="font-semibold">{enrollment.enrollment_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Enrollment Date: </span>
                    <span className="font-semibold">
                      {enrollment.enrollment_date ? formatDateToDDMMYYYY(enrollment.enrollment_date) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">Date Confirmed Positive: </span>
                    <span className="font-semibold">
                      {enrollment.date_confirmed_positive ? formatDateToDDMMYYYY(enrollment.date_confirmed_positive) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">ART Start Date: </span>
                    <span className="font-semibold">
                      {enrollment.art_start_date ? formatDateToDDMMYYYY(enrollment.art_start_date) : 'Not Started'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">Status: </span>
                    <span className="font-semibold capitalize">{enrollment.enrollment_status || 'Active'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Current Treatment */}
            {latestVisit && (
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <h4 className="font-bold text-slate-900 mb-3 text-sm">Current Treatment</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">ARV Regimen: </span>
                    <span className="font-semibold">{latestVisit.arv_regimen_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">ARV Status: </span>
                    <span className="font-semibold">
                      {latestVisit.arv_status === '1' ? 'No ARV' :
                       latestVisit.arv_status === '2' || latestVisit.arv_status === '2a' ? 'Start ARV' :
                       latestVisit.arv_status === '3' ? 'Continue' :
                       latestVisit.arv_status === '4' ? 'Change' :
                       latestVisit.arv_status === '5' ? 'Stop' :
                       latestVisit.arv_status === '6' ? 'Restart' : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">Last Visit Date: </span>
                    <span className="font-semibold">
                      {latestVisit.visit_date ? formatDateToDDMMYYYY(latestVisit.visit_date) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">Next Review Date: </span>
                    <span className="font-semibold">
                      {latestVisit.next_review_date ? formatDateToDDMMYYYY(latestVisit.next_review_date) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Lab Results */}
            <div className="bg-purple-50 rounded-lg p-4 mb-6">
              <h4 className="font-bold text-slate-900 mb-3 text-sm">Latest Lab Results</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-600">Viral Load: </span>
                  <span className="font-semibold">
                    {enrollment.last_viral_load ? `${enrollment.last_viral_load} ${enrollment.baseline_viral_load_unit || 'copies/mL'}` : 'N/A'}
                  </span>
                  {enrollment.last_viral_load_date && (
                    <span className="text-xs text-slate-500 ml-2">
                      ({formatDateToDDMMYYYY(enrollment.last_viral_load_date)})
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-600">CD4 Count: </span>
                  <span className="font-semibold">
                    {enrollment.last_cd4_count ? `${enrollment.last_cd4_count} cells/mm³` : 'N/A'}
                  </span>
                  {enrollment.last_cd4_date && (
                    <span className="text-xs text-slate-500 ml-2">
                      ({formatDateToDDMMYYYY(enrollment.last_cd4_date)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <h4 className="font-bold text-slate-900 mb-2 text-sm">Important Notes</h4>
              <p className="text-xs text-slate-700">
                This card should be presented at all healthcare facilities. Keep this card safe and bring it to every visit.
                For emergencies, contact: {patientDetails?.phone || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HIVPatientSummaryCard;

