import React, { useState } from 'react';
import { CreateTenantRequest } from '../types';
import { Modal } from './Modal';

interface CreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTenantRequest) => void;
  loading: boolean;
}

export const CreateTenantModal: React.FC<CreateTenantModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading
}) => {
  const [formData, setFormData] = useState<CreateTenantRequest>({
    clinicName: '',
    subdomain: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    city: '',
    subscriptionTier: 'basic'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Tenant" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Clinic Name</label>
            <input
              type="text"
              name="clinicName"
              required
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
              value={formData.clinicName}
              onChange={handleChange}
              placeholder="Enter clinic name"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Subdomain</label>
            <div className="relative">
              <input
                type="text"
                name="subdomain"
                required
                pattern="^[a-z0-9\-]+$"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
                value={formData.subdomain}
                onChange={handleChange}
                placeholder="clinic-name"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 text-sm text-slate-500">
                .medicore.co.zw
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2 flex items-center space-x-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Only lowercase letters, numbers, and hyphens</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Email</label>
            <input
              type="email"
              name="contactEmail"
              required
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
              value={formData.contactEmail}
              onChange={handleChange}
              placeholder="admin@clinic.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Phone</label>
            <input
              type="tel"
              name="contactPhone"
              required
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
              value={formData.contactPhone}
              onChange={handleChange}
              placeholder="+263 77 123 4567"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Address</label>
            <input
              type="text"
              name="address"
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
              value={formData.address}
              onChange={handleChange}
              placeholder="123 Medical Street"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">City</label>
            <input
              type="text"
              name="city"
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
              value={formData.city}
              onChange={handleChange}
              placeholder="Harare"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">Subscription Tier</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { value: 'basic', name: 'Basic', price: '$99', features: ['Core eHR', 'Basic Support', '5 Users'] },
              { value: 'professional', name: 'Professional', price: '$199', features: ['Medical Claims', 'Priority Support', '25 Users'] },
              { value: 'enterprise', name: 'Enterprise', price: '$299', features: ['AI CDSS', '24/7 Support', 'Unlimited Users'] }
            ].map((tier) => (
              <label key={tier.value} className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 ${
                formData.subscriptionTier === tier.value 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}>
                <input
                  type="radio"
                  name="subscriptionTier"
                  value={tier.value}
                  checked={formData.subscriptionTier === tier.value}
                  onChange={handleChange}
                  className="sr-only"
                />
                <div className="text-center">
                  <div className="text-lg font-bold text-slate-800">{tier.name}</div>
                  <div className="text-2xl font-bold text-blue-600 my-2">{tier.price}<span className="text-sm text-slate-500">/mo</span></div>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center justify-center space-x-1">
                        <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {formData.subscriptionTier === tier.value && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Creating...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create Tenant</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};