import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import PDFDocument = require('pdfkit');
import * as QRCode from 'qrcode';

@Injectable()
export class PrescriptionPdfService {
  private readonly logger = new Logger(PrescriptionPdfService.name);

  async generatePrescriptionPDF(
    tenantDb: DataSource,
    prescriptionId: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    // Fetch prescription with all relations
    const [prescription] = await tenantDb.query(
      `SELECT 
        p.*,
        pt.first_name as patient_first_name,
        pt.last_name as patient_last_name,
        pt.patient_number,
        pt.date_of_birth,
        pt.gender,
        pt.phone as patient_phone,
        pt.address as patient_address,
        pt.city as patient_city,
        u.first_name as doctor_first_name,
        u.last_name as doctor_last_name,
        u.specialization as doctor_specialization,
        u.license_number as doctor_license
      FROM prescriptions p
      LEFT JOIN patients pt ON pt.id = p.patient_id
      LEFT JOIN users u ON u.id = p.doctor_id
      WHERE p.id = $1`,
      [prescriptionId],
    );

    if (!prescription) {
      throw new NotFoundException(`Prescription ${prescriptionId} not found`);
    }

    // Get tenant information for letterhead
    const clinicName = process.env.CLINIC_NAME || 'MediCore Health';
    const clinicAddress = process.env.CLINIC_ADDRESS || '';
    const clinicPhone = process.env.CLINIC_PHONE || '';
    const clinicEmail = process.env.CLINIC_EMAIL || '';

    // Generate QR code data
    const prescriptionNumber = prescription.prescription_number || prescription.id.substring(0, 8).toUpperCase();
    const qrData = JSON.stringify({
      prescriptionId: prescription.id,
      prescriptionNumber: prescriptionNumber,
      patientNumber: prescription.patient_number,
      medication: prescription.medication_name,
      prescriber: `${prescription.doctor_first_name || ''} ${prescription.doctor_last_name || ''}`.trim(),
      date: prescription.created_at || prescription.prescribed_date,
    });

    // Generate QR code as data URL
    let qrCodeDataUrl: string;
    try {
      qrCodeDataUrl = await QRCode.toDataURL(qrData, { 
        errorCorrectionLevel: 'M',
        width: 200,
        margin: 1,
      });
    } catch (error) {
      this.logger.warn('Failed to generate QR code, continuing without it');
      qrCodeDataUrl = '';
    }

    // Generate PDF
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));

    const ready = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });

    // Header with clinic information
    doc
      .fontSize(24)
      .fillColor('#0ea5e9')
      .font('Helvetica-Bold')
      .text(clinicName, { align: 'left' })
      .moveDown(0.1);

    if (clinicAddress) {
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text(clinicAddress, { align: 'left' });
    }

    if (clinicPhone || clinicEmail) {
      const contactInfo = [clinicPhone, clinicEmail].filter(Boolean).join(' • ');
      doc
        .fontSize(9)
        .fillColor('#6B7280')
        .text(contactInfo, { align: 'left' });
    }

    doc.moveDown(1);

    // Title
    doc
      .fontSize(20)
      .fillColor('#1F2937')
      .font('Helvetica-Bold')
      .text('PRESCRIPTION', { align: 'center' })
      .moveDown(0.5);

    // Prescription Number
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#4B5563')
      .text(`Prescription #: ${prescriptionNumber}`, { align: 'right' })
      .text(`Date: ${new Date(prescription.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'right' })
      .moveDown(1);

    // Patient Information Section
    doc
      .fontSize(14)
      .fillColor('#1F2937')
      .font('Helvetica-Bold')
      .text('Patient Information', { underline: true })
      .moveDown(0.3);

    const patientName = `${prescription.patient_first_name} ${prescription.patient_last_name}`;
    const patientAge = prescription.date_of_birth
      ? Math.floor((new Date().getTime() - new Date(prescription.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 'N/A';

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#374151')
      .text(`Name: ${patientName}`, { continued: false })
      .text(`Patient #: ${prescription.patient_number}`, { continued: false })
      .text(`Age: ${patientAge} years`, { continued: false })
      .text(`Gender: ${prescription.gender || 'N/A'}`, { continued: false });

    if (prescription.patient_phone) {
      doc.text(`Phone: ${prescription.patient_phone}`, { continued: false });
    }

    doc.moveDown(1);

    // Prescriber Information
    doc
      .fontSize(14)
      .fillColor('#1F2937')
      .font('Helvetica-Bold')
      .text('Prescriber Information', { underline: true })
      .moveDown(0.3);

    const doctorName = `Dr. ${prescription.doctor_first_name} ${prescription.doctor_last_name}`;
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#374151')
      .text(`Name: ${doctorName}`, { continued: false });

    if (prescription.doctor_specialization) {
      doc.text(`Specialization: ${prescription.doctor_specialization}`, { continued: false });
    }

    if (prescription.doctor_license) {
      doc.text(`License #: ${prescription.doctor_license}`, { continued: false });
    }

    doc.moveDown(1);

    // Medication Information
    doc
      .fontSize(14)
      .fillColor('#1F2937')
      .font('Helvetica-Bold')
      .text('Medication Details', { underline: true })
      .moveDown(0.3);

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#0ea5e9')
      .text(prescription.medication_name, { continued: false });

    if (prescription.generic_name) {
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text(`Generic: ${prescription.generic_name}`, { continued: false });
    }

    doc.moveDown(0.3);

    // Medication details in a table-like format
    const medDetails = [
      { label: 'Strength', value: prescription.strength },
      { label: 'Form', value: prescription.form },
      { label: 'Dosage', value: prescription.dosage },
      { label: 'Frequency', value: prescription.frequency },
      { label: 'Route', value: prescription.route },
      { label: 'Quantity', value: prescription.quantity?.toString() },
      { label: 'Refills', value: prescription.refills?.toString() || '0' },
    ];

    doc.fontSize(10).font('Helvetica').fillColor('#374151');

    medDetails.forEach((detail, index) => {
      if (detail.value) {
        const x = 50;
        const y = doc.y;
        const colWidth = 250;
        const rowHeight = 20;

        if (index % 2 === 0) {
          doc.text(`${detail.label}:`, x, y, { width: colWidth });
          doc.text(detail.value, x + colWidth, y, { width: colWidth });
        } else {
          doc.text(`${detail.label}:`, x + colWidth * 2, y, { width: colWidth });
          doc.text(detail.value, x + colWidth * 3, y, { width: colWidth });
        }

        if (index % 2 === 1 || index === medDetails.length - 1) {
          doc.moveDown(0.5);
        }
      }
    });

    // Dates
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#374151')
      .text(`Start Date: ${new Date(prescription.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { continued: false });

    if (prescription.end_date) {
      doc.text(`End Date: ${new Date(prescription.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { continued: false });
    }

    doc.moveDown(1);

    // Instructions
    if (prescription.instructions) {
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1F2937')
        .text('Instructions:', { continued: false })
        .moveDown(0.2);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#374151')
        .text(prescription.instructions, { continued: false })
        .moveDown(1);
    }

    // Indication
    if (prescription.indication) {
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1F2937')
        .text('Indication:', { continued: false })
        .moveDown(0.2);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#374151')
        .text(prescription.indication, { continued: false })
        .moveDown(1);
    }

    // Pharmacy Notes
    if (prescription.pharmacy_notes) {
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1F2937')
        .text('Pharmacy Notes:', { continued: false })
        .moveDown(0.2);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#374151')
        .text(prescription.pharmacy_notes, { continued: false })
        .moveDown(1);
    }

    // Status
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#6B7280')
      .text(`Status: ${prescription.status?.toUpperCase() || 'ACTIVE'}`, { align: 'right' })
      .moveDown(1);

    // QR Code
    if (qrCodeDataUrl) {
      const qrImage = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
      doc.image(qrImage, doc.page.width - 150, doc.page.height - 150, {
        width: 100,
        height: 100,
      });

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text('Scan for verification', doc.page.width - 150, doc.page.height - 40, {
          width: 100,
          align: 'center',
        });
    }

    // Footer
    const footerY = doc.page.height - 50;
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#9CA3AF')
      .text(
        'This is a digitally generated prescription. Please verify authenticity before dispensing.',
        doc.page.margins.left,
        footerY,
        {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
          align: 'center',
        },
      );

    // Digital Signature Section
    doc.moveDown(2);
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#374151')
      .text('Prescriber Signature:', { continued: false })
      .moveDown(1);

    // Signature line
    doc
      .moveTo(50, doc.y)
      .lineTo(250, doc.y)
      .strokeColor('#9CA3AF')
      .lineWidth(1)
      .stroke();

    doc.moveDown(0.5);
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#6B7280')
      .text(doctorName, { continued: false })
      .text(new Date(prescription.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), { align: 'right' });

    doc.end();

    const buffer = await ready;

    return {
      buffer,
      fileName: `prescription-${prescriptionNumber}.pdf`,
    };
  }
}

