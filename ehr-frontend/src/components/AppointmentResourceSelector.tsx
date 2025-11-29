import React, { useState, useEffect } from 'react';
import { Building2, Package, Plus, X, AlertCircle } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface Resource {
  id: string;
  name: string;
  type: 'room' | 'equipment';
  description?: string;
  capacity?: number;
  location?: string;
}

interface AppointmentResourceSelectorProps {
  appointmentDate: string;
  appointmentDuration: number;
  selectedResources: string[];
  onResourcesChange: (resourceIds: string[]) => void;
  tenantSlug: string;
  excludeAppointmentId?: string;
}

const AppointmentResourceSelector: React.FC<AppointmentResourceSelectorProps> = ({
  appointmentDate,
  appointmentDuration,
  selectedResources,
  onResourcesChange,
  tenantSlug,
  excludeAppointmentId,
}) => {
  const { showError } = useNotification();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchResources();
  }, []);

  useEffect(() => {
    if (appointmentDate && appointmentDuration && resources.length > 0) {
      checkAvailability();
    }
  }, [appointmentDate, appointmentDuration, resources]);

  const fetchResources = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      const [roomsResponse, equipmentResponse] = await Promise.all([
        ehrApi.getAppointmentResources(token, tenantSlug, 'room'),
        ehrApi.getAppointmentResources(token, tenantSlug, 'equipment'),
      ]);

      const allResources = [
        ...(roomsResponse.data || []),
        ...(equipmentResponse.data || []),
      ];
      setResources(allResources);
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAvailability = async () => {
    if (!appointmentDate) return;

    const token = localStorage.getItem('ehr_token');
    if (!token || !tenantSlug) return;

    const startTime = new Date(appointmentDate);
    const endTime = new Date(startTime.getTime() + appointmentDuration * 60 * 1000);

    const availabilityMap: Record<string, boolean> = {};

    for (const resource of resources) {
      try {
        const isAvailable = await ehrApi.checkResourceAvailability(
          resource.id,
          startTime.toISOString(),
          endTime.toISOString(),
          excludeAppointmentId,
          token,
          tenantSlug
        );
        availabilityMap[resource.id] = isAvailable.data?.available !== false;
      } catch (error) {
        console.error(`Error checking availability for ${resource.name}:`, error);
        availabilityMap[resource.id] = true; // Assume available on error
      }
    }

    setAvailability(availabilityMap);
  };

  const handleResourceToggle = (resourceId: string) => {
    if (selectedResources.includes(resourceId)) {
      onResourcesChange(selectedResources.filter(id => id !== resourceId));
    } else {
      if (availability[resourceId] !== false) {
        onResourcesChange([...selectedResources, resourceId]);
      } else {
        showError('Resource Unavailable', 'This resource is not available at the selected time');
      }
    }
  };

  const rooms = resources.filter(r => r.type === 'room');
  const equipment = resources.filter(r => r.type === 'equipment');

  if (loading) {
    return (
      <div className="text-sm text-gray-500">Loading resources...</div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Select Resources</h4>
        <p className="text-xs text-gray-500 mb-3">
          Optional: Select rooms or equipment needed for this appointment
        </p>

        {/* Rooms */}
        {rooms.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Rooms</span>
            </div>
            <div className="space-y-2">
              {rooms.map(room => {
                const isSelected = selectedResources.includes(room.id);
                const isAvailable = availability[room.id] !== false;
                return (
                  <label
                    key={room.id}
                    className={`flex items-center gap-3 p-2 border rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-blue-300'
                        : isAvailable
                          ? 'border-gray-200 hover:bg-gray-50'
                          : 'border-red-200 bg-red-50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleResourceToggle(room.id)}
                      disabled={!isAvailable}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{room.name}</div>
                      {room.capacity && (
                        <div className="text-xs text-gray-500">Capacity: {room.capacity}</div>
                      )}
                      {room.description && (
                        <div className="text-xs text-gray-500">{room.description}</div>
                      )}
                    </div>
                    {!isAvailable && (
                      <AlertCircle className="h-4 w-4 text-red-500" title="Not available at this time" />
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Equipment */}
        {equipment.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">Equipment</span>
            </div>
            <div className="space-y-2">
              {equipment.map(item => {
                const isSelected = selectedResources.includes(item.id);
                const isAvailable = availability[item.id] !== false;
                return (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 p-2 border rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-purple-50 border-purple-300'
                        : isAvailable
                          ? 'border-gray-200 hover:bg-gray-50'
                          : 'border-red-200 bg-red-50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleResourceToggle(item.id)}
                      disabled={!isAvailable}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.name}</div>
                      {item.location && (
                        <div className="text-xs text-gray-500">Location: {item.location}</div>
                      )}
                      {item.description && (
                        <div className="text-xs text-gray-500">{item.description}</div>
                      )}
                    </div>
                    {!isAvailable && (
                      <AlertCircle className="h-4 w-4 text-red-500" title="Not available at this time" />
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {resources.length === 0 && (
          <div className="text-center py-4 text-sm text-gray-500">
            No resources available. Contact admin to add rooms or equipment.
          </div>
        )}
      </div>
    </div>
  );
};

export default AppointmentResourceSelector;

