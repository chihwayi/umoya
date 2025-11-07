import React, { useState, useEffect } from 'react';
import { useNotification } from './GlobalNotification';
import { ehrApi } from '../services/api';
import { FileText, Download, Calendar, Loader2 } from 'lucide-react';

interface HIVMonthlyReturnFormProps {
  tenantSlug: string;
  token: string;
}

const HIVMonthlyReturnForm: React.FC<HIVMonthlyReturnFormProps> = ({ tenantSlug, token }) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [activeSection, setActiveSection] = useState<'C' | 'D'>('C');

  const ageCategories = [
    '≤2 months', '3-12 months', '13-24 months', '25-59 months',
    '5-9 years', '10-14 years', '15-19 years', '20-24 years',
    '25-29 years', '30-34 years', '35-39 years', '40-44 years',
    '45-49 years', '50-54 years', '55-59 years', '60-64 years', '65+ years'
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await ehrApi.getMonthlyReturn(selectedYear, selectedMonth, token, tenantSlug);
      setData(response.data);
      showSuccess('Monthly return form loaded successfully');
    } catch (error: any) {
      console.error('Error loading monthly return:', error);
      showError(error.response?.data?.message || 'Failed to load monthly return form');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth]);

  const renderAgeSexTable = (indicator: any, description?: string) => {
    if (!indicator || !indicator.Total) return null;

    return (
      <div className="overflow-x-auto mb-6">
        {description && (
          <p className="text-sm text-slate-600 mb-2 font-medium">{description}</p>
        )}
        <table className="min-w-full text-xs border border-slate-300">
          <thead className="bg-slate-100">
            <tr>
              <th rowSpan={2} className="border border-slate-300 px-2 py-2 text-left font-semibold">AGE</th>
              <th colSpan={17} className="border border-slate-300 px-1 py-1 text-center font-semibold">AGE</th>
              <th rowSpan={2} className="border border-slate-300 px-2 py-2 text-center font-semibold">Total</th>
            </tr>
            <tr>
              {ageCategories.map(age => (
                <th key={age} colSpan={2} className="border border-slate-300 px-1 py-1 text-center text-[10px] font-semibold">
                  {age}
                </th>
              ))}
            </tr>
            <tr className="bg-slate-50">
              <th className="border border-slate-300 px-2 py-1 text-left font-semibold">SEX</th>
              {ageCategories.map(age => (
                <React.Fragment key={age}>
                  <th className="border border-slate-300 px-1 py-1 text-center font-semibold">M</th>
                  <th className="border border-slate-300 px-1 py-1 text-center font-semibold">F</th>
                </React.Fragment>
              ))}
              <th className="border border-slate-300 px-2 py-1 text-center font-semibold">M</th>
              <th className="border border-slate-300 px-2 py-1 text-center font-semibold">F</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-300 px-2 py-1 font-medium text-center">All</td>
              {ageCategories.map(age => (
                <React.Fragment key={age}>
                  <td className="border border-slate-300 px-1 py-1 text-center">{indicator[age]?.M || 0}</td>
                  <td className="border border-slate-300 px-1 py-1 text-center">{indicator[age]?.F || 0}</td>
                </React.Fragment>
              ))}
              <td className="border border-slate-300 px-2 py-1 text-center font-semibold">{indicator.Total?.M || 0}</td>
              <td className="border border-slate-300 px-2 py-1 text-center font-semibold">{indicator.Total?.F || 0}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderSectionC = () => {
    if (!data?.sectionC) return null;

    const sectionC = data.sectionC;

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">SECTION C: HIV/TB COLLABORATION</h3>

        {/* C1 */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">C1. Number of PLHIV in care screened for TB during their last visit this month</h4>
          <div className="ml-4 mb-4">
            <p className="text-sm font-medium mb-2">Newly enrolled in HIV Care (Pre/ART Register)</p>
            {renderAgeSexTable(sectionC.C1?.newlyEnrolled)}
            <p className="text-sm font-medium mb-2 mt-4">Already in HIV care (OI/ART Attendance Register)</p>
            {renderAgeSexTable(sectionC.C1?.alreadyInCare)}
          </div>
        </div>

        {/* C2 */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">C2. Number of PLHIV in care screened for TB and had signs of active TB disease (Presumptive Cases)</h4>
          {renderAgeSexTable(sectionC.C2)}
        </div>

        {/* C3 */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">C3. Number of PLHIV in care investigated for active TB disease (Active TB) this month</h4>
          {renderAgeSexTable(sectionC.C3)}
        </div>

        {/* C4 */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">C4. Number of PLHIV in care tested positive for TB disease this month</h4>
          {renderAgeSexTable(sectionC.C4)}
        </div>

        {/* C5 */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">C5. Number PLHIV in care newly initiated on TB treatment this month</h4>
          {renderAgeSexTable(sectionC.C5)}
        </div>

        {/* C6 */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">C6. Number of PLHIV eligible for TB Preventive Therapy this month</h4>
          <div className="ml-4 mb-4">
            <p className="text-sm font-medium mb-2">Newly enrolled in HIV Care (Pre/ ART Register)</p>
            {renderAgeSexTable(sectionC.C6?.newlyEnrolled)}
            <p className="text-sm font-medium mb-2 mt-4">Already in HIV care (OI/ART Attendance Register)</p>
            {renderAgeSexTable(sectionC.C6?.alreadyInCare)}
          </div>
        </div>

        {/* C7 */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">C7. Number of PLHIV enrolled in HIV care who were initiated on Isoniazid and Rifapentine TB Preventive Therapy (3HP) this month</h4>
          <div className="ml-4 mb-4">
            <p className="text-sm font-medium mb-2">Newly enrolled in HIV Care (TPT Register)</p>
            {renderAgeSexTable(sectionC.C7?.newlyEnrolled)}
            <p className="text-sm font-medium mb-2 mt-4">Already in HIV care (TPT Register)</p>
            {renderAgeSexTable(sectionC.C7?.alreadyInCare)}
          </div>
        </div>

        {/* C8 */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">C8. Number of PLHIV enrolled in HIV care who were initiated on Isoniazid TB Preventive Therapy (6H) this month</h4>
          <div className="ml-4 mb-4">
            <p className="text-sm font-medium mb-2">Newly enrolled in HIV Care (TPT Register)</p>
            {renderAgeSexTable(sectionC.C8?.newlyEnrolled)}
            <p className="text-sm font-medium mb-2 mt-4">Already in HIV care (TPT Register)</p>
            {renderAgeSexTable(sectionC.C8?.alreadyInCare)}
          </div>
        </div>

        {/* C9 */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">C9. Number of PLHIV in care on TB Preventive Therapy who developed adverse events this month</h4>
          {renderAgeSexTable(sectionC.C9)}
        </div>

        {/* C10 */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">C10. Number of PLHIV in care who stopped TB Preventive Therapy due to severe adverse events this month</h4>
          {renderAgeSexTable(sectionC.C10)}
        </div>

        {/* C11 */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">C11. Number of PLHIV in care who completed TB Preventive Therapy course this month</h4>
          <div className="ml-4 mb-4">
            <p className="text-sm font-medium mb-2">3HP (TPT Register)</p>
            {renderAgeSexTable(sectionC.C11?.['3HP'])}
            <p className="text-sm font-medium mb-2 mt-4">6H (TPT Register)</p>
            {renderAgeSexTable(sectionC.C11?.['6H'])}
          </div>
        </div>
      </div>
    );
  };

  const renderSectionD = () => {
    if (!data?.sectionD) return null;

    const sectionD = data.sectionD;

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">SECTION D: OPPORTUNISTIC INFECTIONS AND ANTIRETROVIRAL THERAPY</h3>

        {/* D1-D12 */}
        <div className="space-y-4">
          <h4 className="font-bold text-slate-700">TREATMENT AND PROPHYLAXIS</h4>
          
          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D1. Number of newly diagnosed PLHIV registered into care this month</h5>
            {renderAgeSexTable(sectionD.D1)}
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D2. Number of newly diagnosed PLHIV in care in WHO Stage 1 at registration this month</h5>
            {renderAgeSexTable(sectionD.D2)}
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D3. Number of newly diagnosed PLHIV in care in WHO Stage 2 at registration this month</h5>
            {renderAgeSexTable(sectionD.D3)}
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D4. Number of newly diagnosed PLHIV in care in WHO Stage 3 at registration this month</h5>
            {renderAgeSexTable(sectionD.D4)}
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D5. Number of newly diagnosed PLHIV in care in WHO Stage 4 at registration this month</h5>
            {renderAgeSexTable(sectionD.D5)}
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D6. Total number of PLHIV in care currently on CTX prophylaxis this month</h5>
            {renderAgeSexTable(sectionD.D6)}
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D7. Total number of PLHIV in care started on CTX prophylaxis this month</h5>
            {renderAgeSexTable(sectionD.D7)}
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D8. Number of PLHIV in care on CTX who developed adverse events this month</h5>
            {renderAgeSexTable(sectionD.D8)}
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D9. Number of PLHIV in care transferred out before initiation on ART this month</h5>
            {renderAgeSexTable(sectionD.D9)}
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D10. Number of PLHIV in care who transferred in before initiation on ART this month</h5>
            {renderAgeSexTable(sectionD.D10)}
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D11. Total number of PLHIV in care currently on Pre ART this month</h5>
            {renderAgeSexTable(sectionD.D11)}
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D12. PLHIV in Newly ART initiations</h5>
            <div className="ml-4 mb-4">
              <p className="text-sm font-medium mb-2">care tested for CD4</p>
              {renderAgeSexTable(sectionD.D12?.testedForCD4)}
              <p className="text-sm font-medium mb-2 mt-4">Treatment failure</p>
              {renderAgeSexTable(sectionD.D12?.treatmentFailure)}
              <p className="text-sm font-medium mb-2 mt-4">Returning to care after 3 months</p>
              {renderAgeSexTable(sectionD.D12?.returningAfter3Months)}
            </div>
          </div>
        </div>

        {/* D21-D26: Laboratory Services */}
        <div className="space-y-4 mt-8">
          <h4 className="font-bold text-slate-700">LABORATORY SERVICES</h4>
          
          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D21. Number of PLHIV in care on ART who had a sample collected for Viral Load testing this month</h5>
            <div className="ml-4 mb-4">
              <p className="text-sm font-medium mb-2">New</p>
              {renderAgeSexTable(sectionD.D21?.new)}
              <p className="text-sm font-medium mb-2 mt-4">Repeats</p>
              {renderAgeSexTable(sectionD.D21?.repeats)}
            </div>
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D22. Number of PLHIV in care on ART who received Viral Load test results this month</h5>
            <div className="ml-4 mb-4">
              <p className="text-sm font-medium mb-2">&gt;1,000 copies/ml</p>
              {renderAgeSexTable(sectionD.D22?.['>1000'])}
              <p className="text-sm font-medium mb-2 mt-4">Undetectable/not detected</p>
              {renderAgeSexTable(sectionD.D22?.undetectable)}
              <p className="text-sm font-medium mb-2 mt-4">≤1000 copies/ml</p>
              {renderAgeSexTable(sectionD.D22?.['≤1000'])}
            </div>
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D23. Number of PLHIV in care on ART who started Enhanced Adherence Counselling this month</h5>
            <div className="ml-4 mb-4">
              <p className="text-sm font-medium mb-2">&gt;1,000 copies/ml</p>
              {renderAgeSexTable(sectionD.D23?.['>1000'])}
              <p className="text-sm font-medium mb-2 mt-4">≤1000 copies/ml</p>
              {renderAgeSexTable(sectionD.D23?.['≤1000'])}
            </div>
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D24. Number of PLHIV in care on ART who completed EAC this month</h5>
            {renderAgeSexTable(sectionD.D24)}
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D25. Number of PLHIV in care on ART who had second VL Test done this month</h5>
            {renderAgeSexTable(sectionD.D25)}
          </div>
        </div>

        {/* D32-D43: First Line ART */}
        <div className="space-y-4 mt-8">
          <h4 className="font-bold text-slate-700">FIRST LINE ART</h4>
          
          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D32. Number of PLHIV in care newly initiated on first line ART this month</h5>
            {renderAgeSexTable(sectionD.D32)}
          </div>

          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D43. Total number of PLHIV in care currently receiving first line ART</h5>
            {renderAgeSexTable(sectionD.D43)}
          </div>
        </div>

        {/* D49-D53: Second Line ART */}
        <div className="space-y-4 mt-8">
          <h4 className="font-bold text-slate-700">SECOND LINE ART</h4>
          
          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D53. Total number of PLHIV in care currently receiving Second line ART</h5>
            {renderAgeSexTable(sectionD.D53)}
          </div>
        </div>

        {/* D58-D63: Third Line ART */}
        <div className="space-y-4 mt-8">
          <h4 className="font-bold text-slate-700">THIRD LINE ART</h4>
          
          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D63. Total number of PLHIV in care currently receiving Third line ART</h5>
            {renderAgeSexTable(sectionD.D63)}
          </div>
        </div>

        {/* D64: Total on ART */}
        <div className="space-y-4 mt-8">
          <div>
            <h5 className="font-semibold text-slate-700 mb-2">D64. Total number of PLHIV in care currently receiving ART this month (add D43+D53+D63)</h5>
            {renderAgeSexTable(sectionD.D64)}
          </div>
        </div>
      </div>
    );
  };

  const exportToPDF = () => {
    window.print();
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-[1400px] mx-auto bg-white rounded-lg shadow-sm p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Monthly Return Form
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              HIV/AIDS Monthly Return - {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Date Selectors */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="border border-slate-300 rounded px-3 py-1.5 text-sm"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="border border-slate-300 rounded px-3 py-1.5 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>
                    {new Date(2000, month - 1).toLocaleDateString('en-US', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Refresh
            </button>
            <button
              onClick={exportToPDF}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveSection('C')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeSection === 'C'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Section C: HIV/TB Collaboration
          </button>
          <button
            onClick={() => setActiveSection('D')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeSection === 'D'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Section D: ART Summary
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="ml-3 text-slate-600">Loading monthly return form...</span>
          </div>
        ) : data ? (
          <div className="overflow-x-auto">
            {activeSection === 'C' ? renderSectionC() : renderSectionD()}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500">
            No data available for the selected period
          </div>
        )}
      </div>
    </div>
  );
};

export default HIVMonthlyReturnForm;

