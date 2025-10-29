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
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={goPrevMonth} className="p-1 hover:bg-gray-100 rounded">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-medium text-gray-700">{monthLabel}</div>
            <button type="button" onClick={goNextMonth} className="p-1 hover:bg-gray-100 rounded">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs text-gray-500 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weeks.flat().map((d, idx) => {
              const isCurrentMonth = d.getMonth() === currentMonth.getMonth();
              const isSelected = !!selected && d.toDateString() === selected.toDateString();
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectDate(d)}
                  className={
                    'h-8 text-sm rounded ' +
                    (isSelected
                      ? 'bg-blue-600 text-white'
                      : isCurrentMonth
                      ? 'hover:bg-gray-100 text-gray-800'
                      : 'text-gray-400 hover:bg-gray-50')
                  }
                >
                  {d.getDate()}
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


