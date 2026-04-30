import { useRef } from 'react';
import type { GradeMode } from '../types/klym';

const SWATCHES = [
  '#FFFFFF',
  '#0A0A0B',
  '#FF3344',
  '#FF5A1F',
  '#FFD23F',
  '#9DFF4A',
  '#22C55E',
  '#4AA8FF',
  '#1E40AF',
  '#B266FF',
  '#FF66B2',
  '#A78B6F',
];

interface GradeInputProps {
  mode: GradeMode;
  grade: string;
  color?: string;
  onChange: (next: { mode: GradeMode; grade: string; color?: string }) => void;
  compact?: boolean;
}

export function GradeInput({ mode, grade, color, onChange, compact }: GradeInputProps) {
  const colorRef = useRef<HTMLInputElement>(null);

  function setMode(next: GradeMode) {
    if (next === mode) return;
    if (next === 'color') {
      onChange({
        mode: 'color',
        grade: 'COLOR',
        color: color || SWATCHES[3],
      });
    } else {
      onChange({
        mode: 'scale',
        grade: grade && grade !== 'COLOR' ? grade : 'V6',
        color,
      });
    }
  }

  function setColor(next: string) {
    onChange({ mode: 'color', grade: 'COLOR', color: next });
  }

  return (
    <div className={`grade-input ${compact ? 'grade-input-compact' : ''}`}>
      <div className="grade-toggle" role="tablist" aria-label="Grade type">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'scale'}
          data-active={mode === 'scale'}
          onClick={() => setMode('scale')}
        >
          V SCALE
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'color'}
          data-active={mode === 'color'}
          onClick={() => setMode('color')}
        >
          COLOR
        </button>
      </div>
      {mode === 'scale' ? (
        <input
          value={grade}
          onChange={(event) => onChange({ mode: 'scale', grade: event.target.value.toUpperCase(), color })}
          placeholder="V6"
          maxLength={6}
        />
      ) : (
        <div className="grade-palette">
          <div className="grade-swatch-row">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className="grade-swatch"
                data-active={swatch.toLowerCase() === (color || '').toLowerCase()}
                style={{ background: swatch }}
                onClick={() => setColor(swatch)}
                aria-label={`Pick ${swatch}`}
              />
            ))}
            <button
              type="button"
              className="grade-swatch grade-swatch-custom"
              onClick={() => colorRef.current?.click()}
              aria-label="Pick custom color"
            >
              +
              <input
                ref={colorRef}
                type="color"
                value={color || '#FF5A1F'}
                onChange={(event) => setColor(event.target.value.toUpperCase())}
                tabIndex={-1}
              />
            </button>
          </div>
          <div className="grade-current">
            <span className="grade-current-chip" style={{ background: color || '#FF5A1F' }} />
            <code>{(color || '#FF5A1F').toUpperCase()}</code>
          </div>
        </div>
      )}
    </div>
  );
}
