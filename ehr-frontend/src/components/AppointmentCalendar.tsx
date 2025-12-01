import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User } from 'lucide-react';

interface Appointment {
  id: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    patientNumber: string;
  };
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
  };
  appointmentDate: string;
  durationMinutes: number;
  appointmentType: string;
  status: string;
  reason?: string;
}

interface AppointmentCalendarProps {
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  onDateClick?: (date: Date) => void;
  viewMode: 'month' | 'week' | 'day';
  onViewModeChange: (mode: 'month' | 'week' | 'day') => void;
}

const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  appointments,
  onAppointmentClick,
  onDateClick,
  viewMode,
  onViewModeChange,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Month View
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    const getAppointmentsForDate = (date: Date | null) => {
      if (!date) return [];
      return appointments.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        return aptDate.toDateString() === date.toDateString();
      });
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            {monthNames[month]} {year}
          </h2>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => (
            <div key={day} className="text-center font-semibold text-gray-600 py-2">
              {day}
            </div>
          ))}
          {days.map((date, index) => {
            const dayAppointments = getAppointmentsForDate(date);
            const isToday = date && date.toDateString() === new Date().toDateString();
            const isCurrentMonth = date && date.getMonth() === month;

            return (
              <div
                key={index}
                className={`min-h-[100px] border rounded-lg p-2 cursor-pointer transition-all hover:bg-gray-50 ${
                  isToday ? 'bg-blue-50 border-blue-300' : 'border-gray-200'
                } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                onClick={() => date && onDateClick && onDateClick(date)}
              >
                {date && (
                  <>
                    <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayAppointments.slice(0, 3).map(apt => (
                        <div
                          key={apt.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAppointmentClick(apt);
                          }}
                          className={`text-xs p-1 rounded border ${getStatusColor(apt.status)} truncate cursor-pointer hover:shadow-sm`}
                          title={`${apt.patient.firstName} ${apt.patient.lastName} - ${new Date(apt.appointmentDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                        >
                          {new Date(apt.appointmentDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} {apt.patient.firstName}
                        </div>
                      ))}
                      {dayAppointments.length > 3 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{dayAppointments.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Week View
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);

    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      weekDays.push(date);
    }

    const hours = Array.from({ length: 24 }, (_, i) => i);

    const getAppointmentsForDateAndHour = (date: Date, hour: number) => {
      return appointments.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        const aptHour = aptDate.getHours();
        return aptDate.toDateString() === date.toDateString() && aptHour === hour;
      });
    };

    const weekDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-x-auto">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            {weekDays[0].getDate()} {monthNames[weekDays[0].getMonth()]} - {weekDays[6].getDate()} {monthNames[weekDays[6].getMonth()]} {weekDays[0].getFullYear()}
          </h2>
        </div>
        <div className="min-w-[1200px]">
          <div className="grid grid-cols-8 gap-2">
            <div className="font-semibold text-gray-600 py-2"></div>
            {weekDays.map((date, index) => {
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div
                  key={index}
                  className={`text-center font-semibold py-2 rounded ${isToday ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
                >
                  <div>{weekDayNames[date.getDay()]}</div>
                  <div className="text-sm">{date.getDate()}</div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-8 gap-2 max-h-[600px] overflow-y-auto">
            <div className="space-y-1">
              {hours.map(hour => (
                <div key={hour} className="h-16 text-xs text-gray-500 pr-2 text-right pt-1">
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {weekDays.map((date, dayIndex) => (
              <div key={dayIndex} className="space-y-1">
                {hours.map(hour => {
                  const hourAppointments = getAppointmentsForDateAndHour(date, hour);
                  return (
                    <div
                      key={hour}
                      className="h-16 border border-gray-200 rounded p-1 relative hover:bg-gray-50 cursor-pointer"
                      onClick={() => onDateClick && onDateClick(new Date(date.setHours(hour, 0, 0, 0)))}
                    >
                      {hourAppointments.map(apt => (
                        <div
                          key={apt.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAppointmentClick(apt);
                          }}
                          className={`text-xs p-1 rounded border mb-1 ${getStatusColor(apt.status)} cursor-pointer hover:shadow-sm`}
                          title={`${apt.patient.firstName} ${apt.patient.lastName} - ${new Date(apt.appointmentDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                        >
                          <div className="font-medium truncate">
                            {new Date(apt.appointmentDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="truncate">{apt.patient.firstName} {apt.patient.lastName}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Day View
  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayAppointments = appointments.filter(apt => {
      const aptDate = new Date(apt.appointmentDate);
      return aptDate.toDateString() === currentDate.toDateString();
    });

    const getAppointmentsForHour = (hour: number) => {
      return dayAppointments.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        return aptDate.getHours() === hour;
      });
    };

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const isToday = currentDate.toDateString() === new Date().toDateString();

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            {dayNames[currentDate.getDay()]}, {monthNames[currentDate.getMonth()]} {currentDate.getDate()}, {currentDate.getFullYear()}
            {isToday && <span className="ml-2 text-sm text-blue-600">(Today)</span>}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 max-h-[600px] overflow-y-auto">
          <div className="space-y-1">
            {hours.map(hour => (
              <div
                key={hour}
                className="h-20 border border-gray-200 rounded p-2 relative hover:bg-gray-50 cursor-pointer"
                onClick={() => onDateClick && onDateClick(new Date(currentDate.setHours(hour, 0, 0, 0)))}
              >
                <div className="text-xs text-gray-500 mb-1">
                  {hour.toString().padStart(2, '0')}:00 - {(hour + 1).toString().padStart(2, '0')}:00
                </div>
                {getAppointmentsForHour(hour).map(apt => (
                  <div
                    key={apt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick(apt);
                    }}
                    className={`text-sm p-2 rounded border ${getStatusColor(apt.status)} cursor-pointer hover:shadow-sm mb-1`}
                  >
                    <div className="font-medium">
                      {new Date(apt.appointmentDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xs mt-1">
                      <div className="font-semibold">{apt.patient.firstName} {apt.patient.lastName}</div>
                      <div className="text-gray-600">Dr. {apt.doctor.firstName} {apt.doctor.lastName}</div>
                      {apt.reason && <div className="text-gray-500 mt-1">{apt.reason}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-700 mb-2">All Appointments ({dayAppointments.length})</h3>
            {dayAppointments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No appointments scheduled for this day</p>
              </div>
            ) : (
              dayAppointments
                .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
                .map(apt => (
                  <div
                    key={apt.id}
                    onClick={() => onAppointmentClick(apt)}
                    className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${getStatusColor(apt.status)}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">
                          {new Date(apt.appointmentDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="text-xs capitalize">{apt.status.replace('_', ' ')}</span>
                    </div>
                    <div className="text-sm">
                      <div className="font-semibold">{apt.patient.firstName} {apt.patient.lastName}</div>
                      <div className="text-gray-600 flex items-center gap-1 mt-1">
                        <User className="h-3 w-3" />
                        Dr. {apt.doctor.firstName} {apt.doctor.lastName}
                      </div>
                      {apt.reason && <div className="text-gray-500 mt-1 text-xs">{apt.reason}</div>}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between bg-white/70 backdrop-blur-sm rounded-xl border border-slate-200/50 p-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            Today
          </button>
          <button
            onClick={() => navigateDate('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewModeChange('month')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => onViewModeChange('week')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'week' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => onViewModeChange('day')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'day' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Day
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'day' && renderDayView()}
    </div>
  );
};

export default AppointmentCalendar;


