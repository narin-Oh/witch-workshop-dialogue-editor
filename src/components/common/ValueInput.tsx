import { useEffect, useState } from 'react';
import type { Value, ValueType } from '../../model/types';

interface Props {
  type: ValueType;
  value: Value;
  onChange: (v: Value) => void;
  label?: string;
  className?: string;
}

/** Input for a typed value: number (integers), true/false select, or text. */
export function ValueInput({ type, value, onChange, label, className = '' }: Props) {
  if (type === 'bool') {
    return (
      <select className={`input ${className}`} aria-label={label} value={String(value === true)} onChange={(e) => onChange(e.target.value === 'true')}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (type === 'int') return <IntInput value={typeof value === 'number' ? value : 0} onChange={onChange} label={label} className={className} />;
  return <input className={`input ${className}`} aria-label={label} value={typeof value === 'string' ? value : String(value)} onChange={(e) => onChange(e.target.value)} />;
}

/** Keeps a local text buffer so users can type "-" or clear the field without it snapping to 0. */
function IntInput({ value, onChange, label, className }: { value: number; onChange: (v: number) => void; label?: string; className: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((t) => (Number(t) === value && /^-?\d+$/.test(t) ? t : String(value)));
  }, [value]);
  return (
    <input
      className={`input ${className}`}
      aria-label={label}
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        if (/^-?\d+$/.test(t)) onChange(parseInt(t, 10));
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

export function TypeSelect({ value, onChange, label }: { value: ValueType; onChange: (t: ValueType) => void; label?: string }) {
  return (
    <select className="input" aria-label={label} value={value} onChange={(e) => onChange(e.target.value as ValueType)}>
      <option value="int">int</option>
      <option value="bool">bool</option>
      <option value="string">string</option>
    </select>
  );
}
