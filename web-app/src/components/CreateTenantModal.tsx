import React, { useState, useRef } from 'react';
import { CreateTenantRequest } from '../types';
import { Modal } from './Modal';
import { tenantAPI } from '../services/api';

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
    subscriptionTier: 'basic',
    logoUrl: ''
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalLogoUrl = formData.logoUrl;

    if (logoFile) {
      try {
        setUploading(true);
        const { url } = await tenantAPI.uploadTenantLogo(logoFile);
        finalLogoUrl = url;
      } catch (error) {
        console.error('Failed to upload logo', error);
        alert('Failed to upload logo, but proceeding with tenant creation.');
      } finally {
        setUploading(false);
      }
    }

    onSubmit({
      ...formData,
      logoUrl: finalLogoUrl
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Tenant" size="xl">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Logo Upload Section */}
        <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 transition-colors cursor-pointer group"
             onDragOver={handleDragOver}
             onDrop={handleDrop}
             onClick={() => fileInputRef.current?.click()}>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
          {logoPreview ? (
            <div className="relative">
              <img src={logoPreview} alt="Logo Preview" className="h-24 w-24 object-contain rounded-lg shadow-sm bg-white p-1" />
              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                <span className="text-white text-xs font-medium bg-black bg-opacity-50 px-2 py-1 rounded">Change</span>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="mx-auto h-12 w-12 text-slate-400 mb-3 group-hover:text-blue-500 transition-colors">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-900">Upload Clinic Logo</p>
              <p className="text-xs text-slate-500 mt-1">Drag & drop or click to select</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Clinic Name</label>
            <input
              type="text"
              name="clinicName"
              required
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
              value={formData.clinicName}
              onChange={handleChange}
              placeholder="e.g. Westside Medical Center"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Subdomain</label>
            <div className="relative group">
              <input
                type="text"
                name="subdomain"
                required
                pattern="^[a-z0-9\-]+$"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
                value={formData.subdomain}
                onChange={handleChange}
                placeholder="clinic-name"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 text-sm text-slate-500 bg-slate-50 rounded-r-xl border-l border-slate-300 pl-3">
                .medicore.co.zw
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2 ml-1">Lowercase letters, numbers, hyphens only</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Email</label>
            <input
              type="email"
              name="contactEmail"
              required
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
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
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
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
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
              value={formData.address}
              onChange={handleChange}
              placeholder="Street Address"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">City</label>
            <input
              type="text"
              name="city"
              className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
              value={formData.city}
              onChange={handleChange}
              placeholder="City"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">Subscription Tier</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { value: 'basic', name: 'Basic', price: '$99', features: ['Core eHR', '5 Users'], color: 'blue' },
              { value: 'professional', name: 'Professional', price: '$199', features: ['Medical Claims', '25 Users'], color: 'indigo' },
              { value: 'enterprise', name: 'Enterprise', price: '$299', features: ['AI CDSS', 'Unlimited'], color: 'purple' }
            ].map((tier) => {
              const isSelected = formData.subscriptionTier === tier.value;
              const colorClasses = {
                basic: isSelected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : '',
                professional: isSelected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : '',
                enterprise: isSelected ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500' : ''
              };
              const textClasses = {
                basic: isSelected ? 'text-blue-700' : 'text-slate-700',
                professional: isSelected ? 'text-indigo-700' : 'text-slate-700',
                enterprise: isSelected ? 'text-purple-700' : 'text-slate-700'
              };
              const checkBg = {
                basic: 'bg-blue-500',
                professional: 'bg-indigo-500',
                enterprise: 'bg-purple-500'
              };

              return (
                <label key={tier.value} className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-md ${
                  isSelected ? colorClasses[tier.value as keyof typeof colorClasses] : 'border-slate-200 bg-white hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="subscriptionTier"
                    value={tier.value}
                    checked={formData.subscriptionTier === tier.value}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <div className="flex justify-between items-start mb-2">
                    <span className={`font-bold ${textClasses[tier.value as keyof typeof textClasses]}`}>
                      {tier.name}
                    </span>
                    {isSelected && (
                      <div className={`h-5 w-5 rounded-full ${checkBg[tier.value as keyof typeof checkBg]} flex items-center justify-center`}>
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="text-xl font-bold text-slate-900 mb-2">{tier.price}<span className="text-sm font-normal text-slate-500">/mo</span></div>
                  <ul className="space-y-1">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="text-xs text-slate-600 flex items-center">
                        <svg className="w-3 h-3 mr-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || uploading}
            className={`px-8 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 ${
              (loading || uploading) ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-blue-300 hover:-translate-y-0.5'
            }`}
          >
            {uploading ? 'Uploading Logo...' : loading ? 'Creating Tenant...' : 'Create Tenant'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
