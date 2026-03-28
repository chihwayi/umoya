import React, { useEffect, useState } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { useNotification } from '../components/GlobalNotification';
import { Link } from 'react-router-dom';
import {
  Award, Trophy, Star, Flame, CheckCircle, Heart, TrendingUp, ArrowLeft, Target
} from 'lucide-react';
import { format } from 'date-fns';

interface Achievement {
  id: string;
  achievement_type: string;
  achievement_name: string;
  achievement_description: string;
  badge_icon: string;
  badge_color: string;
  points: number;
  earned_at: string;
  streak_days?: number;
  milestone_percentage?: number;
}

interface Streak {
  streak_type: string;
  current_streak_days: number;
  longest_streak_days: number;
  last_activity_date: string;
}

const AchievementsPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const { showError } = useNotification();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPoints, setTotalPoints] = useState(0);

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      setLoading(true);
      const [achievementsData, streaksData] = await Promise.all([
        patientPortalApi.getAchievements(token!, tenantSlug),
        patientPortalApi.getStreaks(token!, tenantSlug),
      ]);

      const achievementsList = Array.isArray(achievementsData) ? achievementsData : [];
      setAchievements(achievementsList);
      setTotalPoints(achievementsList.reduce((sum, a) => sum + (a.points || 0), 0));
      setStreaks(Array.isArray(streaksData) ? streaksData : []);
    } catch (err: any) {
      console.error('Error loading achievements:', err);
      showError('Failed to load achievements', err.message || 'Please try again later');
    } finally {
      setLoading(false);
    }
  };

  const getBadgeIcon = (iconName: string) => {
    const icons: Record<string, any> = {
      trophy: Trophy,
      star: Star,
      flame: Flame,
      'check-circle': CheckCircle,
      heart: Heart,
      'trending-up': TrendingUp,
      award: Award,
    };
    return icons[iconName] || Award;
  };

  const getStreakTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      vitals_submission: 'Vitals Submission',
      medication_adherence: 'Medication Adherence',
      exercise: 'Exercise',
      goal_progress: 'Goal Progress',
      portal_login: 'Portal Login',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading achievements...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              to={`/${tenantSlug}/dashboard`}
              className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Achievements</h1>
              <p className="text-gray-600 mt-1">Your health journey milestones and streaks</p>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Points</p>
                <p className="text-2xl font-bold text-gray-900">{totalPoints}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <Flame className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Streaks</p>
                <p className="text-2xl font-bold text-gray-900">{streaks.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <Star className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Achievements</p>
                <p className="text-2xl font-bold text-gray-900">{achievements.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Streaks */}
        {streaks.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Flame className="w-6 h-6 text-orange-500" />
              Active Streaks
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {streaks.map((streak, index) => (
                <div key={index} className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">{getStreakTypeLabel(streak.streak_type)}</h3>
                    <Flame className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-600">Current Streak</p>
                      <p className="text-2xl font-bold text-orange-600">{streak.current_streak_days} days</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Longest Streak</p>
                      <p className="text-lg font-semibold text-gray-700">{streak.longest_streak_days} days</p>
                    </div>
                    {streak.last_activity_date && (
                      <p className="text-xs text-gray-500">
                        Last activity: {format(new Date(streak.last_activity_date), 'MMM dd, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="w-6 h-6 text-purple-600" />
            Your Achievements
          </h2>
          {achievements.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
              <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Achievements Yet</h3>
              <p className="text-gray-600 mb-6">
                Keep working towards your goals to earn achievements and badges!
              </p>
              <Link
                to={`/${tenantSlug}/goals`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg font-semibold"
              >
                <Target className="w-5 h-5" />
                View Goals
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {achievements.map((achievement) => {
                const BadgeIcon = getBadgeIcon(achievement.badge_icon || 'award');
                return (
                  <div
                    key={achievement.id}
                    className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: achievement.badge_color || '#8b5cf620' }}
                      >
                        <BadgeIcon
                          className="w-8 h-8"
                          style={{ color: achievement.badge_color || '#8b5cf6' }}
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">{achievement.achievement_name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{achievement.achievement_description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {achievement.points} points
                          </span>
                          <span>{format(new Date(achievement.earned_at), 'MMM dd, yyyy')}</span>
                        </div>
                        {achievement.streak_days && (
                          <div className="mt-2 flex items-center gap-1 text-sm text-orange-600">
                            <Flame className="w-4 h-4" />
                            <span>{achievement.streak_days} day streak</span>
                          </div>
                        )}
                        {achievement.milestone_percentage && (
                          <div className="mt-2 text-sm text-purple-600 font-semibold">
                            {achievement.milestone_percentage}% milestone
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AchievementsPage;

