import React, { useState, useEffect } from 'react';
import {
  GitBranch, CheckCircle, Clock, TrendingUp, Award, BookOpen,
  Search, Filter, Plus, Eye, Users
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface PathwayManagementProps {
  patientId?: string;
  tenantSlug: string;
  token: string;
}

const PathwayManagement: React.FC<PathwayManagementProps> = ({
  patientId,
  tenantSlug,
  token,
}) => {
  const { showError, showSuccess } = useNotification();
  const [pathways, setPathways] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('all');

  useEffect(() => {
    loadPathways();
    if (patientId) loadEnrollments();
  }, [patientId]);

  const loadPathways = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getClinicalPathways({ isActive: true }, token, tenantSlug);
      setPathways(response.data || []);
    } catch (error) {
      console.error('Failed to load pathways:', error);
      showError('Error', 'Failed to load clinical pathways');
    } finally {
      setLoading(false);
    }
  };

  const loadEnrollments = async () => {
    try {
      if (!patientId) return;
      const response = await ehrApi.getPatientPathwayEnrollments(patientId, token, tenantSlug);
      setEnrollments(response.data || []);
    } catch (error) {
      console.error('Failed to load enrollments:', error);
    }
  };

  const getSpecialtyColor = (specialty: string) => {
    switch (specialty?.toLowerCase()) {
      case 'cardiology': return 'from-red-500 to-rose-600';
      case 'neurology': return 'from-purple-500 to-indigo-600';
      case 'pulmonology': return 'from-blue-500 to-cyan-600';
      case 'endocrinology': return 'from-green-500 to-emerald-600';
      case 'emergency_medicine': return 'from-orange-500 to-red-500';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const filteredPathways = pathways.filter(pathway => {
    const matchesSearch = !searchTerm ||
      pathway.pathwayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pathway.condition?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSpecialty = filterSpecialty === 'all' || pathway.specialty === filterSpecialty;
    
    return matchesSearch && matchesSpecialty;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading pathways...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 sm:p-6 border border-indigo-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg">
            <GitBranch className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Clinical Pathways</h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Evidence-based protocols • {pathways.length} pathways available
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search pathways..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterSpecialty}
              onChange={(e) => setFilterSpecialty(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm appearance-none"
            >
              <option value="all">All Specialties</option>
              <option value="cardiology">Cardiology</option>
              <option value="neurology">Neurology</option>
              <option value="pulmonology">Pulmonology</option>
              <option value="endocrinology">Endocrinology</option>
              <option value="emergency_medicine">Emergency Medicine</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pathway Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredPathways.map(pathway => (
          <div
            key={pathway.id}
            className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 group"
          >
            {/* Gradient Background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${getSpecialtyColor(pathway.specialty)} opacity-90 group-hover:opacity-100 transition-opacity`}></div>
            
            {/* Content */}
            <div className="relative p-4 sm:p-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              
              <h3 className="text-base sm:text-lg font-bold text-white mb-2 drop-shadow-sm line-clamp-2">
                {pathway.pathwayName}
              </h3>
              
              <p className="text-xs sm:text-sm text-white/90 mb-3 line-clamp-2">
                {pathway.condition}
              </p>
              
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/80">
                <span className="px-2 py-1 bg-white/20 rounded-full backdrop-blur-sm">
                  {pathway.evidenceLevel ? `Grade ${pathway.evidenceLevel}` : 'Evidence-based'}
                </span>
                {pathway.specialty && (
                  <span className="px-2 py-1 bg-white/20 rounded-full backdrop-blur-sm capitalize">
                    {pathway.specialty}
                  </span>
                )}
                {pathway.pathwayDurationDays && (
                  <span className="px-2 py-1 bg-white/20 rounded-full backdrop-blur-sm">
                    {pathway.pathwayDurationDays} days
                  </span>
                )}
              </div>
            </div>
            
            {/* Shimmer */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PathwayManagement;

