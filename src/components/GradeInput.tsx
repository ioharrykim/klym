import { useRef } from 'react';
import { useI18n } from '../lib/i18n';
import type { GradeMode } from '../types/klym';

const SWATCHES = [
  { value: '#FFFFFF', name: 'White', nameKo: '흰색' },
  { value: '#0A0A0B', name: 'Black', nameKo: '검정' },
  { value: '#FF3344', name: 'Red', nameKo: '빨강' },
  { value: '#FF5A1F', name: 'Orange', nameKo: '주황' },
  { value: '#FFD23F', name: 'Yellow', nameKo: '노랑' },
  { value: '#9DFF4A', name: 'Lime', nameKo: '라임' },
  { value: '#22C55E', name: 'Green', nameKo: '초록' },
  { value: '#4AA8FF', name: 'Blue', nameKo: '파랑' },
  { value: '#1E40AF', name: 'Navy', nameKo: '남색' },
  { value: '#B266FF', name: 'Purple', nameKo: '보라' },
  { value: '#FF66B2', name: 'Pink', nameKo: '분홍' },
  { value: '#A78B6F', name: 'Wood', nameKo: '우드' },
];

interface GradeInputProps {
  mode: GradeMode;
  grade: string;
  color?: string;
  onChange: (next: { mode: GradeMode; grade: string; color?: string }) => void;
  compact?: boolean;
}

export function GradeInput({ mode, grade, color, onChange, compact }: GradeInputProps) {
  const { language, t } = useI18n();
  const colorRef = useRef<HTMLInputElement>(null);

  function setMode(next: GradeMode) {
    if (next === mode) return;
    if (next === 'color') {
      onChange({
        mode: 'color',
        grade: 'COLOR',
        color: color || SWATCHES[3].value,
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
      <div className="grade-toggle" role="tablist" aria-label={t('grade.type')}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'scale'}
          data-active={mode === 'scale'}
          onClick={() => setMode('scale')}
        >
          {t('grade.vScale')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'color'}
          data-active={mode === 'color'}
          onClick={() => setMode('color')}
        >
          {t('grade.color')}
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
                key={swatch.value}
                type="button"
                className="grade-swatch"
                data-active={swatch.value.toLowerCase() === (color || '').toLowerCase()}
                style={{ background: swatch.value }}
                onClick={() => setColor(swatch.value)}
                aria-label={t('grade.pickNamedColor', { name: language === 'ko' ? swatch.nameKo : swatch.name })}
              />
            ))}
            <button
              type="button"
              className="grade-swatch grade-swatch-custom"
              onClick={() => colorRef.current?.click()}
              aria-label={t('grade.pickCustom')}
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
