import { forwardRef, useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';
import '../styles/date_select_picker.css';

function pad(value) {
  return String(value).padStart(2, '0');
}

function getDateParts(date) {
  if (!date || Number.isNaN(date.getTime())) {
    return { year: '', month: '', day: '' };
  }

  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1),
    day: String(date.getDate()),
  };
}

function getDaysInMonth(year, month) {
  if (!year || !month) return 31;
  return new Date(Number(year), Number(month), 0).getDate();
}

function isSameYearMonth(date, year, month) {
  return (
    date &&
    date.getFullYear() === Number(year) &&
    date.getMonth() + 1 === Number(month)
  );
}

function isInRange(date, minDate, maxDate) {
  if (!date || Number.isNaN(date.getTime())) return false;
  if (minDate && date < minDate) return false;
  if (maxDate && date > maxDate) return false;
  return true;
}

function getAvailableMonths(year, minDate, maxDate) {
  if (!year) return Array.from({ length: 12 }, (_, index) => index + 1);

  const numericYear = Number(year);
  const minMonth = numericYear === minDate.getFullYear() ? minDate.getMonth() + 1 : 1;
  const maxMonth = numericYear === maxDate.getFullYear() ? maxDate.getMonth() + 1 : 12;

  return Array.from({ length: maxMonth - minMonth + 1 }, (_, index) => minMonth + index);
}

function getAvailableDays(year, month, minDate, maxDate) {
  if (!year || !month) return Array.from({ length: 31 }, (_, index) => index + 1);

  const lastDay = getDaysInMonth(year, month);
  const minDay = isSameYearMonth(minDate, year, month) ? minDate.getDate() : 1;
  const maxDay = isSameYearMonth(maxDate, year, month) ? maxDate.getDate() : lastDay;

  return Array.from({ length: maxDay - minDay + 1 }, (_, index) => minDay + index);
}

const CalendarButton = forwardRef(function CalendarButton(
  { value, onClick, disabled, placeholder },
  ref
) {
  return (
    <button
      type="button"
      className="date_select_calendar_button"
      onClick={onClick}
      disabled={disabled}
      ref={ref}
      aria-label={value || placeholder || '날짜 선택'}
    >
      달력
    </button>
  );
});

function DateSelectPicker({
  value,
  onChange,
  disabled = false,
  minDate = new Date(1900, 0, 1),
  maxDate = new Date(),
  className = '',
  placeholder = '날짜',
}) {
  const [parts, setParts] = useState(() => getDateParts(value));

  useEffect(() => {
    setParts(getDateParts(value));
  }, [value]);

  const years = useMemo(() => {
    const minYear = minDate.getFullYear();
    const maxYear = maxDate.getFullYear();
    return Array.from({ length: maxYear - minYear + 1 }, (_, index) => maxYear - index);
  }, [minDate, maxDate]);

  const months = useMemo(() => {
    return getAvailableMonths(parts.year, minDate, maxDate);
  }, [parts.year, minDate, maxDate]);

  const days = useMemo(() => {
    return getAvailableDays(parts.year, parts.month, minDate, maxDate);
  }, [parts.year, parts.month, minDate, maxDate]);

  const emitDate = nextParts => {
    if (!nextParts.year || !nextParts.month || !nextParts.day) {
      onChange(null);
      return;
    }

    const date = new Date(
      Number(nextParts.year),
      Number(nextParts.month) - 1,
      Number(nextParts.day),
      12
    );

    onChange(isInRange(date, minDate, maxDate) ? date : null);
  };

  const updatePart = (field, nextValue) => {
    setParts(prev => {
      const nextParts = { ...prev, [field]: nextValue };
      const nextMonths = getAvailableMonths(nextParts.year, minDate, maxDate);

      if (field === 'year' && nextParts.month && !nextMonths.includes(Number(nextParts.month))) {
        nextParts.month = '';
        nextParts.day = '';
      }

      if ((field === 'year' || field === 'month') && nextParts.day) {
        const nextDays = getAvailableDays(nextParts.year, nextParts.month, minDate, maxDate);
        if (!nextDays.includes(Number(nextParts.day))) nextParts.day = '';
      }

      emitDate(nextParts);
      return nextParts;
    });
  };

  return (
    <div className={`date_select_picker ${className}`}>
      <select
        value={parts.year}
        onChange={event => updatePart('year', event.target.value)}
        disabled={disabled}
        aria-label="연도"
      >
        <option value="">연도</option>
        {years.map(year => (
          <option value={year} key={year}>{year}년</option>
        ))}
      </select>

      <select
        value={parts.month}
        onChange={event => updatePart('month', event.target.value)}
        disabled={disabled || !parts.year}
        aria-label="월"
      >
        <option value="">월</option>
        {months.map(month => (
          <option value={month} key={month}>{pad(month)}월</option>
        ))}
      </select>

      <select
        value={parts.day}
        onChange={event => updatePart('day', event.target.value)}
        disabled={disabled || !parts.year || !parts.month}
        aria-label="일"
      >
        <option value="">일</option>
        {days.map(day => (
          <option value={day} key={day}>{pad(day)}일</option>
        ))}
      </select>

      <DatePicker
        selected={value}
        onChange={onChange}
        locale={ko}
        dateFormat="yyyy-MM-dd"
        minDate={minDate}
        maxDate={maxDate}
        disabled={disabled}
        popperClassName="date_select_calendar"
        showPopperArrow={false}
        placeholderText={placeholder}
        customInput={<CalendarButton placeholder={placeholder} />}
        renderCustomHeader={({ date, changeYear, changeMonth }) => (
          <div className="date_select_header">
            <select
              value={date.getFullYear()}
              onChange={event => changeYear(Number(event.target.value))}
              aria-label="달력 연도"
            >
              {years.slice().reverse().map(year => (
                <option value={year} key={year}>{year}년</option>
              ))}
            </select>
            <select
              value={date.getMonth()}
              onChange={event => changeMonth(Number(event.target.value))}
              aria-label="달력 월"
            >
              {Array.from({ length: 12 }, (_, index) => (
                <option value={index} key={index}>{pad(index + 1)}월</option>
              ))}
            </select>
          </div>
        )}
      />
    </div>
  );
}

export default DateSelectPicker;
