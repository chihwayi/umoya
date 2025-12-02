import React, { useState, useEffect } from 'react';
import { Search, Building2, Phone, Mail, MapPin, Clock, X } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface ReferralFacilityDirectoryProps {
  tenantSlug: string;
  token: string;
  onClose?: () => void;
  onSelectFacility?: (facility: any) => void;
}

const ReferralFacilityDirectory: React.FC<ReferralFacilityDirectoryProps> = ({
  tenantSlug,
  token,
  onClose,
  onSelectFacility,
}) => {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [filteredFacilities, setFilteredFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedFacility, setSelectedFacility] = useState<any>(null);
  const { showError } = useNotification();

  useEffect(() => {
    loadFacilities();
  }, [typeFilter]);

  useEffect(() => {
    filterFacilities();
  }, [facilities, searchTerm]);

  const loadFacilities = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (typeFilter) filters.facilityType = typeFilter;

      const response = await ehrApi.getReferralFacilities(filters, token, tenantSlug);
      setFacilities(response.data || []);
    } catch (error: any) {
      showError('Error', 'Failed to load facilities');
    } finally {
      setLoading(false);
    }
  };

  const filterFacilities = () => {
    if (!searchTerm) {
      setFilteredFacilities(facilities);
      return;
    }

    const filtered = facilities.filter((facility) =>
      facility.facility_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      facility.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      facility.specialties?.some((s: string) => s.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredFacilities(filtered);
  };

  const handleSelectFacility = (facility: any) => {
    if (onSelectFacility) {
      onSelectFacility(facility);
      if (onClose) onClose();
    } else {
      setSelectedFacility(facility);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Building2 className="w-6 h-6" />
              Referral Facilities Directory
            </h2>
            <p className="text-blue-100 text-sm mt-1">Browse available referral facilities</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search facilities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value="hospital">Hospital</option>
            <option value="clinic">Clinic</option>
            <option value="specialist_practice">Specialist Practice</option>
            <option value="laboratory">Laboratory</option>
            <option value="imaging_center">Imaging Center</option>
            <option value="therapy_center">Therapy Center</option>
          </select>
        </div>
      </div>

      {/* Facilities List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : selectedFacility ? (
          // Detailed View
          <div>
            <button
              onClick={() => setSelectedFacility(null)}
              className="mb-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to list
            </button>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">{selectedFacility.facility_name}</h3>
              <p className="text-slate-600 mb-4">{selectedFacility.facility_type.replace('_', ' ')}</p>

              {selectedFacility.specialties && selectedFacility.specialties.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedFacility.specialties.map((specialty: string, index: number) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {specialty}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-3 text-sm">
                {selectedFacility.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
                    <div>
                      <p className="text-slate-700">{selectedFacility.address}</p>
                      {selectedFacility.city && <p className="text-slate-600">{selectedFacility.city}</p>}
                    </div>
                  </div>
                )}
                {selectedFacility.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <p className="text-slate-700">{selectedFacility.phone}</p>
                  </div>
                )}
                {selectedFacility.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-500" />
                    <p className="text-slate-700">{selectedFacility.email}</p>
                  </div>
                )}
                {selectedFacility.contact_person && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <p className="text-slate-700">Contact: {selectedFacility.contact_person}</p>
                  </div>
                )}
                {selectedFacility.average_wait_time_days && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <p className="text-slate-700">Average wait: {selectedFacility.average_wait_time_days} days</p>
                  </div>
                )}
              </div>

              {selectedFacility.referral_process && (
                <div className="mt-4 p-3 bg-white rounded-lg">
                  <h4 className="font-semibold text-slate-800 mb-2 text-sm">Referral Process</h4>
                  <p className="text-slate-600 text-sm">{selectedFacility.referral_process}</p>
                </div>
              )}

              {selectedFacility.required_documents && selectedFacility.required_documents.length > 0 && (
                <div className="mt-4 p-3 bg-white rounded-lg">
                  <h4 className="font-semibold text-slate-800 mb-2 text-sm">Required Documents</h4>
                  <ul className="list-disc list-inside text-slate-600 text-sm space-y-1">
                    {selectedFacility.required_documents.map((doc: string, index: number) => (
                      <li key={index}>{doc}</li>
                    ))}
                  </ul>
                </div>
              )}

              {onSelectFacility && (
                <button
                  onClick={() => handleSelectFacility(selectedFacility)}
                  className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Select This Facility
                </button>
              )}
            </div>
          </div>
        ) : filteredFacilities.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="text-lg font-medium">No facilities found</p>
          </div>
        ) : (
          // List View
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFacilities.map((facility) => (
              <div
                key={facility.id}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleSelectFacility(facility)}
              >
                <h3 className="font-semibold text-slate-800 mb-2">{facility.facility_name}</h3>
                <p className="text-sm text-slate-600 mb-2">{facility.facility_type.replace('_', ' ')}</p>
                {facility.specialties && facility.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {facility.specialties.slice(0, 3).map((specialty: string, index: number) => (
                      <span key={index} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                        {specialty}
                      </span>
                    ))}
                    {facility.specialties.length > 3 && (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                        +{facility.specialties.length - 3} more
                      </span>
                    )}
                  </div>
                )}
                <div className="text-xs text-slate-500 space-y-1">
                  {facility.city && (
                    <p className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {facility.city}
                    </p>
                  )}
                  {facility.average_wait_time_days && (
                    <p className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~{facility.average_wait_time_days} days wait
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralFacilityDirectory;


import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface ReferralFacilityDirectoryProps {
  tenantSlug: string;
  token: string;
  onClose?: () => void;
  onSelectFacility?: (facility: any) => void;
}

const ReferralFacilityDirectory: React.FC<ReferralFacilityDirectoryProps> = ({
  tenantSlug,
  token,
  onClose,
  onSelectFacility,
}) => {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [filteredFacilities, setFilteredFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedFacility, setSelectedFacility] = useState<any>(null);
  const { showError } = useNotification();

  useEffect(() => {
    loadFacilities();
  }, [typeFilter]);

  useEffect(() => {
    filterFacilities();
  }, [facilities, searchTerm]);

  const loadFacilities = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (typeFilter) filters.facilityType = typeFilter;

      const response = await ehrApi.getReferralFacilities(filters, token, tenantSlug);
      setFacilities(response.data || []);
    } catch (error: any) {
      showError('Error', 'Failed to load facilities');
    } finally {
      setLoading(false);
    }
  };

  const filterFacilities = () => {
    if (!searchTerm) {
      setFilteredFacilities(facilities);
      return;
    }

    const filtered = facilities.filter((facility) =>
      facility.facility_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      facility.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      facility.specialties?.some((s: string) => s.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredFacilities(filtered);
  };

  const handleSelectFacility = (facility: any) => {
    if (onSelectFacility) {
      onSelectFacility(facility);
      if (onClose) onClose();
    } else {
      setSelectedFacility(facility);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Building2 className="w-6 h-6" />
              Referral Facilities Directory
            </h2>
            <p className="text-blue-100 text-sm mt-1">Browse available referral facilities</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search facilities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value="hospital">Hospital</option>
            <option value="clinic">Clinic</option>
            <option value="specialist_practice">Specialist Practice</option>
            <option value="laboratory">Laboratory</option>
            <option value="imaging_center">Imaging Center</option>
            <option value="therapy_center">Therapy Center</option>
          </select>
        </div>
      </div>

      {/* Facilities List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : selectedFacility ? (
          // Detailed View
          <div>
            <button
              onClick={() => setSelectedFacility(null)}
              className="mb-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to list
            </button>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">{selectedFacility.facility_name}</h3>
              <p className="text-slate-600 mb-4">{selectedFacility.facility_type.replace('_', ' ')}</p>

              {selectedFacility.specialties && selectedFacility.specialties.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedFacility.specialties.map((specialty: string, index: number) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {specialty}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-3 text-sm">
                {selectedFacility.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
                    <div>
                      <p className="text-slate-700">{selectedFacility.address}</p>
                      {selectedFacility.city && <p className="text-slate-600">{selectedFacility.city}</p>}
                    </div>
                  </div>
                )}
                {selectedFacility.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <p className="text-slate-700">{selectedFacility.phone}</p>
                  </div>
                )}
                {selectedFacility.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-500" />
                    <p className="text-slate-700">{selectedFacility.email}</p>
                  </div>
                )}
                {selectedFacility.contact_person && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <p className="text-slate-700">Contact: {selectedFacility.contact_person}</p>
                  </div>
                )}
                {selectedFacility.average_wait_time_days && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <p className="text-slate-700">Average wait: {selectedFacility.average_wait_time_days} days</p>
                  </div>
                )}
              </div>

              {selectedFacility.referral_process && (
                <div className="mt-4 p-3 bg-white rounded-lg">
                  <h4 className="font-semibold text-slate-800 mb-2 text-sm">Referral Process</h4>
                  <p className="text-slate-600 text-sm">{selectedFacility.referral_process}</p>
                </div>
              )}

              {selectedFacility.required_documents && selectedFacility.required_documents.length > 0 && (
                <div className="mt-4 p-3 bg-white rounded-lg">
                  <h4 className="font-semibold text-slate-800 mb-2 text-sm">Required Documents</h4>
                  <ul className="list-disc list-inside text-slate-600 text-sm space-y-1">
                    {selectedFacility.required_documents.map((doc: string, index: number) => (
                      <li key={index}>{doc}</li>
                    ))}
                  </ul>
                </div>
              )}

              {onSelectFacility && (
                <button
                  onClick={() => handleSelectFacility(selectedFacility)}
                  className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Select This Facility
                </button>
              )}
            </div>
          </div>
        ) : filteredFacilities.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="text-lg font-medium">No facilities found</p>
          </div>
        ) : (
          // List View
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFacilities.map((facility) => (
              <div
                key={facility.id}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleSelectFacility(facility)}
              >
                <h3 className="font-semibold text-slate-800 mb-2">{facility.facility_name}</h3>
                <p className="text-sm text-slate-600 mb-2">{facility.facility_type.replace('_', ' ')}</p>
                {facility.specialties && facility.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {facility.specialties.slice(0, 3).map((specialty: string, index: number) => (
                      <span key={index} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                        {specialty}
                      </span>
                    ))}
                    {facility.specialties.length > 3 && (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                        +{facility.specialties.length - 3} more
                      </span>
                    )}
                  </div>
                )}
                <div className="text-xs text-slate-500 space-y-1">
                  {facility.city && (
                    <p className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {facility.city}
                    </p>
                  )}
                  {facility.average_wait_time_days && (
                    <p className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~{facility.average_wait_time_days} days wait
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralFacilityDirectory;

