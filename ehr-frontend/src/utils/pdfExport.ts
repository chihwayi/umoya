import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface VisitPDFData {
  patientName: string;
  patientNumber: string;
  enrollmentNumber: string;
  visitDate: string;
  visitNumber: number;
  visitType: string;
  provider: string;
  // Vital Signs
  weightKg?: number;
  heightCm?: number;
  bmi?: number;
  bloodPressure?: string;
  // Clinical Status
  whoClinicalStage?: string;
  functionalStatus?: string;
  // ARV
  arvStatus?: string;
  arvRegimenName?: string;
  arvQuantityDispensed?: number;
  arvAdherencePercentage?: number;
  // Lab Results
  viralLoad?: number;
  viralLoadUnit?: string;
  viralLoadTestDate?: string;
  cd4Count?: number;
  cd4TestDate?: string;
  // Notes
  visitNotes?: string;
  nextReviewDate?: string;
}

export const exportVisitToPDF = (visitData: VisitPDFData): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = margin;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('HIV Clinical Visit Summary', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Patient Information
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Patient Information', margin, yPos);
  yPos += 7;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Name: ${visitData.patientName}`, margin, yPos);
  yPos += 5;
  doc.text(`Patient ID: ${visitData.patientNumber}`, margin, yPos);
  yPos += 5;
  doc.text(`Enrollment Number: ${visitData.enrollmentNumber}`, margin, yPos);
  yPos += 5;
  doc.text(`Visit Date: ${visitData.visitDate}`, margin, yPos);
  yPos += 5;
  doc.text(`Visit Number: ${visitData.visitNumber}`, margin, yPos);
  yPos += 5;
  doc.text(`Visit Type: ${visitData.visitType}`, margin, yPos);
  yPos += 5;
  doc.text(`Provider: ${visitData.provider}`, margin, yPos);
  yPos += 10;

  // Vital Signs
  if (visitData.weightKg || visitData.heightCm || visitData.bmi || visitData.bloodPressure) {
    doc.setFont('helvetica', 'bold');
    doc.text('Vital Signs', margin, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    
    if (visitData.weightKg) {
      doc.text(`Weight: ${visitData.weightKg} kg`, margin, yPos);
      yPos += 5;
    }
    if (visitData.heightCm) {
      doc.text(`Height: ${visitData.heightCm} cm`, margin, yPos);
      yPos += 5;
    }
    if (visitData.bmi) {
      doc.text(`BMI: ${visitData.bmi}`, margin, yPos);
      yPos += 5;
    }
    if (visitData.bloodPressure) {
      doc.text(`Blood Pressure: ${visitData.bloodPressure}`, margin, yPos);
      yPos += 5;
    }
    yPos += 5;
  }

  // Clinical Status
  if (visitData.whoClinicalStage || visitData.functionalStatus) {
    doc.setFont('helvetica', 'bold');
    doc.text('Clinical Status', margin, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    
    if (visitData.whoClinicalStage) {
      doc.text(`WHO Stage: ${visitData.whoClinicalStage}`, margin, yPos);
      yPos += 5;
    }
    if (visitData.functionalStatus) {
      doc.text(`Functional Status: ${visitData.functionalStatus}`, margin, yPos);
      yPos += 5;
    }
    yPos += 5;
  }

  // ARV Information
  if (visitData.arvStatus || visitData.arvRegimenName) {
    doc.setFont('helvetica', 'bold');
    doc.text('ARV Treatment', margin, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    
    if (visitData.arvStatus) {
      doc.text(`ARV Status: ${visitData.arvStatus}`, margin, yPos);
      yPos += 5;
    }
    if (visitData.arvRegimenName) {
      doc.text(`Regimen: ${visitData.arvRegimenName}`, margin, yPos);
      yPos += 5;
    }
    if (visitData.arvQuantityDispensed) {
      doc.text(`Quantity Dispensed: ${visitData.arvQuantityDispensed}`, margin, yPos);
      yPos += 5;
    }
    if (visitData.arvAdherencePercentage) {
      doc.text(`Adherence: ${visitData.arvAdherencePercentage}%`, margin, yPos);
      yPos += 5;
    }
    yPos += 5;
  }

  // Lab Results
  if (visitData.viralLoad || visitData.cd4Count) {
    doc.setFont('helvetica', 'bold');
    doc.text('Lab Results', margin, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    
    if (visitData.viralLoad) {
      doc.text(`Viral Load: ${visitData.viralLoad} ${visitData.viralLoadUnit || 'copies/mL'}`, margin, yPos);
      yPos += 5;
      if (visitData.viralLoadTestDate) {
        doc.text(`VL Test Date: ${visitData.viralLoadTestDate}`, margin, yPos);
        yPos += 5;
      }
    }
    if (visitData.cd4Count) {
      doc.text(`CD4 Count: ${visitData.cd4Count} cells/mm³`, margin, yPos);
      yPos += 5;
      if (visitData.cd4TestDate) {
        doc.text(`CD4 Test Date: ${visitData.cd4TestDate}`, margin, yPos);
        yPos += 5;
      }
    }
    yPos += 5;
  }

  // Visit Notes
  if (visitData.visitNotes) {
    doc.setFont('helvetica', 'bold');
    doc.text('Visit Notes', margin, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    
    const splitNotes = doc.splitTextToSize(visitData.visitNotes, pageWidth - 2 * margin);
    doc.text(splitNotes, margin, yPos);
    yPos += splitNotes.length * 5;
    yPos += 5;
  }

  // Next Review Date
  if (visitData.nextReviewDate) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Next Review Date: ${visitData.nextReviewDate}`, margin, yPos);
    yPos += 10;
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Generated on ${new Date().toLocaleDateString()} - Page ${i} of ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save PDF
  doc.save(`HIV_Visit_${visitData.patientNumber}_${visitData.visitDate.replace(/\//g, '_')}.pdf`);
};

export const exportQualityMetricsToPDF = (metrics: any, facilityName?: string): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = margin;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('HIV Quality Metrics Report', pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;
  if (facilityName) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(facilityName, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }
  doc.setFontSize(10);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Metrics Table
  const tableData: any[] = [];
  
  if (metrics.vlSuppression) {
    tableData.push([
      'Viral Load Suppression Rate',
      `${metrics.vlSuppression.suppressedRate?.toFixed(1) || 0}%`,
      `${metrics.vlSuppression.suppressed || 0} / ${metrics.vlSuppression.total || 0}`
    ]);
  }
  
  if (metrics.patientsOnART) {
    tableData.push([
      'Patients on ART',
      `${metrics.patientsOnART.onARTRate?.toFixed(1) || 0}%`,
      `${metrics.patientsOnART.onART || 0} / ${metrics.patientsOnART.total || 0}`
    ]);
  }
  
  if (metrics.treatmentFailure) {
    tableData.push([
      'Treatment Failure Rate',
      `${metrics.treatmentFailure.failureRate?.toFixed(1) || 0}%`,
      `${metrics.treatmentFailure.failures || 0} / ${metrics.treatmentFailure.total || 0}`
    ]);
  }
  
  if (metrics.ltfu) {
    tableData.push([
      'Lost to Follow-Up Rate',
      `${metrics.ltfu.ltfuRate?.toFixed(1) || 0}%`,
      `${metrics.ltfu.ltfu || 0} / ${metrics.ltfu.total || 0}`
    ]);
  }

  if (tableData.length > 0) {
    (doc as any).autoTable({
      startY: yPos,
      head: [['Metric', 'Rate', 'Count']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10 },
      margin: { left: margin, right: margin }
    });
  }

  // Save PDF
  doc.save(`HIV_Quality_Metrics_${new Date().toISOString().split('T')[0]}.pdf`);
};

