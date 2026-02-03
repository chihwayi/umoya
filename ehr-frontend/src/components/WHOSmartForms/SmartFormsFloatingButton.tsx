/**
 * Floating Smart Forms Button
 * 
 * A floating action button that can be added to any dashboard
 * to provide quick access to WHO Smart Forms
 */

import React, { useState } from 'react';
import { Activity, X } from 'lucide-react';
import { UniversalSmartFormsPanel } from './UniversalSmartFormsPanel';
import ModalPortal from '../ModalPortal';

interface SmartFormsFloatingButtonProps {
  patientId?: string;
  patientName?: string;
  token: string;
  tenantSlug: string;
  onFormSubmit?: (formId: string, formData: Record<string, any>) => void;
  moduleFilter?: 'hiv' | 'tb' | 'maternity' | 'clinical' | 'all';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export const SmartFormsFloatingButton: React.FC<SmartFormsFloatingButtonProps> = ({
  patientId,
  patientName,
  token,
  tenantSlug,
  onFormSubmit,
  moduleFilter = 'all',
  position = 'bottom-right',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed ${positionClasses[position]} z-50 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full p-4 shadow-2xl hover:shadow-indigo-500/50 transition-all duration-300 flex items-center gap-2 group`}
        title="Open WHO Smart Forms"
      >
        <Activity className="w-6 h-6 group-hover:scale-110 transition-transform" />
        <span className="hidden md:inline font-semibold">WHO Forms</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 overflow-y-auto flex-1">
                <UniversalSmartFormsPanel
                  patientId={patientId}
                  patientName={patientName}
                  token={token}
                  tenantSlug={tenantSlug}
                  onFormSubmit={(formId, formData) => {
                    if (onFormSubmit) {
                      onFormSubmit(formId, formData);
                    }
                    setIsOpen(false);
                  }}
                  onClose={() => setIsOpen(false)}
                  moduleFilter={moduleFilter}
                  showAsModal={false}
                />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};


