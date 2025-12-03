import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateForInput, parseDateFromInput, isValidDate } from '../utils/dateUtils';

interface DatePickerProps {
  label?: string;
  value: string; // dd/mm/yyyy
  onChange: (newValue: string) => void;
  placeholder?: string;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DatePicker: React.FC<DatePickerProps> = ({ label, value, onChange, placeholder = 'dd/mm/yyyy' }) => {
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (isValidDate(value)) return parseDateFromInput(value);
    return new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const weeks = useMemo(() => {
    const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    const chunks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) chunks.push(days.slice(i, i + 7));
    return chunks;
  }, [currentMonth]);

  const selectDate = (d: Date) => {
    const formatted = formatDateForInput(d);
    onChange(formatted);
    setOpen(false);
  };

  const selectToday = () => {
    const today = new Date();
    const formatted = formatDateForInput(today);
    onChange(formatted);
    setCurrentMonth(today);
    setOpen(false);
  };

  const goPrevMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    setCurrentMonth(d);
  };
  const goNextMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    setCurrentMonth(d);
  };

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    if (isValidDate(v)) {
      setCurrentMonth(parseDateFromInput(v));
    }
  };

  const monthLabel = currentMonth.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  const selected = isValidDate(value) ? parseDateFromInput(value) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <CalendarIcon className="h-4 w-4" />
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleManualChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <CalendarIcon
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 cursor-pointer"
          onClick={() => setOpen((o) => !o)}
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          {/* Header with Month Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={goPrevMonth} className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold text-gray-700">{monthLabel}</div>
            <button type="button" onClick={goNextMonth} className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Today Button */}
          <button
            type="button"
            onClick={selectToday}
            className="w-full mb-3 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-sm"
          >
            <CalendarIcon className="h-4 w-4" />
            Select Today
          </button>
          <div className="grid grid-cols-7 gap-1 text-xs text-gray-500 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weeks.flat().map((d, idx) => {
              const dateOnly = new Date(d);
              dateOnly.setHours(0, 0, 0, 0);
              const isCurrentMonth = d.getMonth() === currentMonth.getMonth();
              const isSelected = !!selected && d.toDateString() === selected.toDateString();
              const isToday = dateOnly.getTime() === today.getTime();
              
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectDate(d)}
                  className={
                    'h-8 text-sm rounded font-medium transition-all duration-200 relative ' +
                    (isSelected
                      ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300'
                      : isToday
                      ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white font-bold shadow-md ring-2 ring-green-300 hover:from-green-600 hover:to-emerald-700'
                      : isCurrentMonth
                      ? 'hover:bg-blue-50 text-gray-800 hover:ring-1 hover:ring-blue-200'
                      : 'text-gray-400 hover:bg-gray-50')
                  }
                >
                  {d.getDate()}
                  {isToday && !isSelected && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full ring-2 ring-white"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;


