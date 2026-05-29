import React, { useRef, useState } from 'react';
import { X, Download, Printer, Copy, Check } from 'lucide-react';
import jsPDF from 'jspdf';
import { tenantApi } from '../services/api';

interface TenantQRModalProps {
  tenant: {
    id: string;
    clinicName: string;
    subdomain: string;
    logoUrl?: string;
    subscriptionTier?: string;
  };
  onClose: () => void;
}

export const TenantQRModal: React.FC<TenantQRModalProps> = ({ tenant, onClose }) => {
  const qrUrl = tenantApi.getTenantQrUrl(tenant.id);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const logoSrc = `${process.env.PUBLIC_URL || ''}/umoya.png`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toDataUrl = (url: string): Promise<string> =>
    fetch(url)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }),
      );

  const handlePDF = async () => {
    setPdfLoading(true);
    try {
      const [qrData, logoData] = await Promise.all([
        toDataUrl(qrUrl),
        toDataUrl(logoSrc).catch(() => null),
      ]);

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210;
      const H = 297;

      // ── Background ────────────────────────────────────────────────────────
      pdf.setFillColor(8, 14, 26); // #080E1A
      pdf.rect(0, 0, W, H, 'F');

      // ── Subtle teal glow top-centre ────────────────────────────────────────
      pdf.setFillColor(0, 200, 150);
      pdf.setGState(new (pdf as any).GState({ opacity: 0.06 }));
      pdf.ellipse(W / 2, 30, 60, 30, 'F');
      pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

      // ── Top accent line ────────────────────────────────────────────────────
      pdf.setDrawColor(0, 200, 150);
      pdf.setLineWidth(0.8);
      pdf.line(20, 18, W - 20, 18);

      // ── Umoya logo ──────────────────────────────────────────────────────
      if (logoData) {
        // white pill background for the logo
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(W / 2 - 30, 22, 60, 18, 4, 4, 'F');
        pdf.addImage(logoData, 'PNG', W / 2 - 28, 23.5, 56, 15);
      } else {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(0, 200, 150);
        pdf.text('UMOYA', W / 2, 32, { align: 'center' });
      }

      // ── "Clinic Access QR" badge ───────────────────────────────────────────
      pdf.setFillColor(0, 200, 150, 0.12 as any);
      pdf.setFillColor(0, 44, 33);
      pdf.roundedRect(W / 2 - 28, 44, 56, 8, 2, 2, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(0, 200, 150);
      pdf.text('CLINIC ACCESS QR CODE', W / 2, 49.2, { align: 'center', charSpace: 1.2 });

      // ── QR code ────────────────────────────────────────────────────────────
      const qrSize = 90;
      const qrX = (W - qrSize) / 2;
      const qrY = 58;

      // White border/frame around QR
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, 6, 6, 'F');
      // Teal corner accents (4 corners)
      const cornerSize = 8;
      const cornerR = qrX - 5;
      const cornerB = qrY - 5;
      pdf.setDrawColor(0, 200, 150);
      pdf.setLineWidth(2);
      // TL
      pdf.line(cornerR, cornerB + cornerSize, cornerR, cornerB);
      pdf.line(cornerR, cornerB, cornerR + cornerSize, cornerB);
      // TR
      pdf.line(cornerR + qrSize + 10 - cornerSize, cornerB, cornerR + qrSize + 10, cornerB);
      pdf.line(cornerR + qrSize + 10, cornerB, cornerR + qrSize + 10, cornerB + cornerSize);
      // BL
      pdf.line(cornerR, cornerB + qrSize + 10 - cornerSize, cornerR, cornerB + qrSize + 10);
      pdf.line(cornerR, cornerB + qrSize + 10, cornerR + cornerSize, cornerB + qrSize + 10);
      // BR
      pdf.line(cornerR + qrSize + 10 - cornerSize, cornerB + qrSize + 10, cornerR + qrSize + 10, cornerB + qrSize + 10);
      pdf.line(cornerR + qrSize + 10, cornerB + qrSize + 10 - cornerSize, cornerR + qrSize + 10, cornerB + qrSize + 10);

      pdf.addImage(qrData, 'PNG', qrX, qrY, qrSize, qrSize);

      // ── Clinic name ────────────────────────────────────────────────────────
      const infoY = qrY + qrSize + 18;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(22);
      pdf.setTextColor(232, 240, 255);
      pdf.text(tenant.clinicName, W / 2, infoY, { align: 'center' });

      // ── Subdomain ──────────────────────────────────────────────────────────
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(125, 200, 202);
      pdf.text(`${tenant.subdomain}.umoya.health`, W / 2, infoY + 9, { align: 'center' });

      // ── Divider ────────────────────────────────────────────────────────────
      pdf.setDrawColor(37, 58, 88);
      pdf.setLineWidth(0.4);
      pdf.line(30, infoY + 17, W - 30, infoY + 17);

      // ── Scan instructions ──────────────────────────────────────────────────
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(175, 193, 223);
      pdf.text('Scan to access this clinic on the Umoya app', W / 2, infoY + 26, { align: 'center' });

      // ── Step-by-step instructions box ─────────────────────────────────────
      const boxY = infoY + 33;
      pdf.setFillColor(14, 24, 41);
      pdf.setDrawColor(37, 58, 88);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(20, boxY, W - 40, 38, 4, 4, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(0, 200, 150);
      pdf.text('HOW TO USE', W / 2, boxY + 7, { align: 'center', charSpace: 1 });

      const steps = [
        '1  Download the Umoya app from the App Store or Google Play',
        '2  Open the app and tap "Select Your Clinic"',
        '3  Tap the QR icon and point your camera at this code',
        '4  Sign in with your clinic credentials',
      ];
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(175, 193, 223);
      steps.forEach((step, i) => {
        pdf.text(step, W / 2, boxY + 14 + i * 6.5, { align: 'center' });
      });

      // ── Bottom divider ─────────────────────────────────────────────────────
      pdf.setDrawColor(0, 200, 150);
      pdf.setLineWidth(0.8);
      pdf.line(20, H - 18, W - 20, H - 18);

      // ── Footer ─────────────────────────────────────────────────────────────
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(90, 120, 160);
      pdf.text('umoya.health  ·  AI-Powered Clinical Platform  ·  Confidential — For clinic use only', W / 2, H - 11, { align: 'center' });

      pdf.save(`${tenant.subdomain}-umoya-qr.pdf`);
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${tenant.clinicName} — Umoya QR</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    @page { size: A4; margin: 0; }
    .page {
      width: 210mm; min-height: 297mm;
      background: #080E1A;
      display: flex; flex-direction: column; align-items: center;
      padding: 28mm 20mm 20mm;
      position: relative;
      overflow: hidden;
    }
    .glow {
      position: absolute; top: -60px; left: 50%; transform: translateX(-50%);
      width: 300px; height: 160px;
      background: radial-gradient(ellipse, rgba(0,200,150,0.18) 0%, transparent 70%);
      pointer-events: none;
    }
    .top-line, .bottom-line {
      position: absolute; left: 20mm; right: 20mm; height: 1px;
      background: #0AA98A;
    }
    .top-line { top: 18mm; }
    .bottom-line { bottom: 18mm; }
    .logo-wrap {
      background: #fff; border-radius: 10px;
      padding: 6px 14px; margin-bottom: 14px;
      display: inline-block;
    }
    .logo-wrap img { height: 36px; display: block; }
    .badge {
      background: #002C21; color: #0AA98A;
      font-size: 8px; font-weight: 700; letter-spacing: 2px;
      text-transform: uppercase; border-radius: 4px;
      padding: 4px 14px; margin-bottom: 24px;
    }
    .qr-frame {
      border: 5px solid #fff; border-radius: 14px;
      padding: 6px; position: relative;
      box-shadow: 0 0 0 2px #253A58;
    }
    .qr-frame::before, .qr-frame::after,
    .qr-frame span::before, .qr-frame span::after {
      content: ''; position: absolute;
      width: 20px; height: 20px;
      border-color: #0AA98A; border-style: solid;
    }
    .qr-frame::before  { top: -4px; left: -4px;  border-width: 3px 0 0 3px; border-radius: 4px 0 0 0; }
    .qr-frame::after   { top: -4px; right: -4px; border-width: 3px 3px 0 0; border-radius: 0 4px 0 0; }
    .qr-frame span::before { bottom: -4px; left: -4px;  border-width: 0 0 3px 3px; border-radius: 0 0 0 4px; }
    .qr-frame span::after  { bottom: -4px; right: -4px; border-width: 0 3px 3px 0; border-radius: 0 0 4px 0; }
    .qr-frame img { display: block; width: 68mm; height: 68mm; }
    .clinic-name {
      color: #E8F0FF; font-size: 26px; font-weight: 700;
      margin-top: 22px; text-align: center;
    }
    .subdomain {
      font-family: 'Courier New', monospace;
      color: #7DC8CA; font-size: 11px;
      margin-top: 6px; margin-bottom: 16px;
    }
    .divider { width: 120mm; height: 1px; background: #253A58; margin-bottom: 16px; }
    .scan-hint { color: #AFC1DF; font-size: 12px; margin-bottom: 20px; text-align: center; }
    .steps-box {
      background: #0E1829; border: 1px solid #253A58;
      border-radius: 10px; padding: 14px 20px;
      width: 100%; max-width: 140mm;
    }
    .steps-title { color: #0AA98A; font-size: 8px; font-weight: 700; letter-spacing: 2px; text-align: center; margin-bottom: 10px; }
    .step { color: #AFC1DF; font-size: 9px; line-height: 1.9; }
    .footer {
      position: absolute; bottom: 24mm;
      color: #4A6585; font-size: 7.5px; text-align: center;
    }
    @media print {
      body { background: #080E1A; }
      .page { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="glow"></div>
  <div class="top-line"></div>
  <div class="logo-wrap">
    <img src="${window.location.origin}/umoya.png" alt="Umoya" />
  </div>
  <div class="badge">Clinic Access QR Code</div>
  <div class="qr-frame">
    <span></span>
    <img src="${qrUrl}" alt="QR Code" crossorigin="anonymous" />
  </div>
  <div class="clinic-name">${tenant.clinicName}</div>
  <div class="subdomain">${tenant.subdomain}.umoya.health</div>
  <div class="divider"></div>
  <div class="scan-hint">Scan to access this clinic on the Umoya app</div>
  <div class="steps-box">
    <div class="steps-title">HOW TO USE</div>
    <div class="step">1&nbsp;&nbsp;Download the Umoya app from the App Store or Google Play</div>
    <div class="step">2&nbsp;&nbsp;Open the app and tap "Select Your Clinic"</div>
    <div class="step">3&nbsp;&nbsp;Tap the QR icon and point your camera at this code</div>
    <div class="step">4&nbsp;&nbsp;Sign in with your clinic credentials</div>
  </div>
  <div class="footer">umoya.health &nbsp;·&nbsp; AI-Powered Clinical Platform &nbsp;·&nbsp; Confidential — For clinic use only</div>
  <div class="bottom-line"></div>
</div>
<script>window.onload = function() { window.print(); };</script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-[32px] border border-white/10 bg-[#0E1829] shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#7A92B8]">Clinic Access</p>
            <h2 className="text-base font-semibold text-white">{tenant.clinicName}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-[#8EA7CD] transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center px-8 py-6">
          <div className="relative mb-5">
            {/* Teal glow behind QR */}
            <div className="absolute inset-0 -z-10 rounded-2xl bg-[#0AA98A]/10 blur-xl" />
            <div className="rounded-2xl border border-[#0AA98A]/30 bg-white p-3 shadow-[0_0_40px_rgba(0,200,150,0.15)]">
              <img
                ref={imgRef}
                src={qrUrl}
                alt={`${tenant.clinicName} QR Code`}
                className="h-52 w-52 rounded-lg"
                crossOrigin="anonymous"
              />
            </div>
            {/* Corner accents */}
            {(['tl','tr','bl','br'] as const).map((c) => (
              <div
                key={c}
                className={`absolute h-5 w-5 border-[#0AA98A] border-2 ${
                  c === 'tl' ? 'left-0 top-0 rounded-tl-lg border-r-0 border-b-0' :
                  c === 'tr' ? 'right-0 top-0 rounded-tr-lg border-l-0 border-b-0' :
                  c === 'bl' ? 'left-0 bottom-0 rounded-bl-lg border-r-0 border-t-0' :
                               'right-0 bottom-0 rounded-br-lg border-l-0 border-t-0'
                }`}
              />
            ))}
          </div>

          {/* Clinic info */}
          <p className="text-center text-sm font-semibold text-[#E8F0FF]">{tenant.clinicName}</p>
          <p className="mt-1 font-mono text-[11px] text-[#7DC8CA]">{tenant.subdomain}.umoya.health</p>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-[#8EA7CD]">
            Place this QR code where patients and staff can scan it with the Umoya app.
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2 border-t border-white/10 px-4 py-4">
          <button
            onClick={handleCopy}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-[11px] font-medium text-[#A8BEDD] transition hover:bg-white/10 hover:text-white"
          >
            {copied ? <Check className="h-4 w-4 text-[#0AA98A]" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy URL'}
          </button>
          <button
            onClick={handlePDF}
            disabled={pdfLoading}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-[#3B9EFF]/30 bg-[#3B9EFF]/10 px-2 py-3 text-[11px] font-medium text-[#93BCFF] transition hover:bg-[#3B9EFF]/20 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {pdfLoading ? 'Building…' : 'Download PDF'}
          </button>
          <button
            onClick={handlePrint}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-[#0AA98A]/30 bg-[#0AA98A]/10 px-2 py-3 text-[11px] font-medium text-[#7DE8CA] transition hover:bg-[#0AA98A]/20"
          >
            <Printer className="h-4 w-4" />
            Print PDF
          </button>
        </div>
      </div>
    </div>
  );
};
