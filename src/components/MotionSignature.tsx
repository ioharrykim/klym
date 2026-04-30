import type { CSSProperties } from 'react';
import type { MotionSignatureData, MotionSignatureStyle, MotionPoint } from '../types/klym';
import { clamp, generateSeedPath, motionPointAtProgress, partialSmoothPath, scaledPoints, smoothPath } from '../lib/signature';
import { tokens } from '../lib/tokens';

const VB_W = 280;
const VB_H = 380;

interface MotionSignatureProps {
  seed?: number;
  data?: MotionSignatureData;
  style?: MotionSignatureStyle;
  accent?: string;
  ink?: string;
  showGrid?: boolean;
  showLabels?: boolean;
  animate?: boolean;
  strokeScale?: number;
  progress?: number;
  className?: string;
}

export function MotionSignature({
  seed = 7,
  data,
  style = data?.style || 'dynamic',
  accent = tokens.accent,
  ink = tokens.paper,
  showGrid = true,
  showLabels = false,
  animate = false,
  strokeScale = 1,
  progress,
  className,
}: MotionSignatureProps) {
  const seedPath = data ? null : generateSeedPath(seed, VB_W, VB_H);
  const points = data ? scaledPoints(data.points, VB_W, VB_H) : seedPath?.points || [];
  const path = data ? data.svgPath : smoothPath(points);
  const visiblePath = progress === undefined ? path : partialSmoothPath(points, progress);
  const cruxPoints = points.filter((point) => point.dyno);
  const cruxPoint = activeSpotlightPoint(points, cruxPoints, progress);
  const minorPoint = points.find((point) => 'minor' in point && point.minor);
  const baseStroke = 2.4 * strokeScale;

  return (
    <svg
      className={[className, animate && progress === undefined ? 'signature-animate' : ''].filter(Boolean).join(' ')}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-label="Motion Signature"
    >
      <defs>
        <filter id="klymBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      {showGrid && <SignatureGrid ink={ink} />}
      {style === 'data' && (
        <DataSignature
          points={points}
          path={path}
          visiblePath={visiblePath}
          ink={ink}
          accent={accent}
          baseStroke={baseStroke}
          cruxPoint={cruxPoint}
          animate={animate}
          progress={progress}
        />
      )}
      {style === 'refined' && (
        <RefinedSignature
          points={points}
          path={path}
          visiblePath={visiblePath}
          ink={ink}
          accent={accent}
          baseStroke={baseStroke}
          cruxPoint={cruxPoint}
          minorPoint={minorPoint}
          animate={animate}
          progress={progress}
        />
      )}
      {style === 'editorial' && (
        <EditorialSignature
          points={points}
          path={path}
          visiblePath={visiblePath}
          ink={ink}
          accent={accent}
          baseStroke={baseStroke}
          cruxPoint={cruxPoint}
          animate={animate}
          progress={progress}
        />
      )}
      {style === 'dynamic' && (
        <DynamicSignature
          points={points}
          path={path}
          visiblePath={visiblePath}
          ink={ink}
          accent={accent}
          baseStroke={baseStroke}
          cruxPoint={cruxPoint}
          animate={animate}
          progress={progress}
        />
      )}
      {showLabels && (
        <g className="signature-labels" fill={ink}>
          <text x="4" y="10">
            TOP
          </text>
          <text x="4" y={VB_H - 4}>
            START
          </text>
          <text x={VB_W - 52} y="10">
            MOTION
          </text>
        </g>
      )}
    </svg>
  );
}

function SignatureGrid({ ink }: { ink: string }) {
  return (
    <g opacity="0.06" stroke={ink} strokeWidth="0.4">
      {Array.from({ length: 8 }).map((_, index) => (
        <line key={`v${index}`} x1={(VB_W / 8) * index} y1="0" x2={(VB_W / 8) * index} y2={VB_H} />
      ))}
      {Array.from({ length: 12 }).map((_, index) => (
        <line key={`h${index}`} x1="0" y1={(VB_H / 12) * index} x2={VB_W} y2={(VB_H / 12) * index} />
      ))}
    </g>
  );
}

function DataSignature({
  points,
  path,
  visiblePath,
  ink,
  accent,
  baseStroke,
  cruxPoint,
  animate,
  progress,
}: {
  points: MotionPoint[];
  path: string;
  visiblePath: string;
  ink: string;
  accent: string;
  baseStroke: number;
  cruxPoint?: MotionPoint;
  animate: boolean;
  progress?: number;
}) {
  const visiblePoints = progress === undefined ? points : points.filter((point) => (point.t ?? 0) <= progress);
  return (
    <g className={animate ? 'signature-draw' : undefined}>
      <g stroke={ink} strokeOpacity="0.4" strokeWidth="0.6">
        <line x1="6" y1="6" x2="16" y2="6" />
        <line x1="6" y1="6" x2="6" y2="16" />
        <line x1={VB_W - 6} y1="6" x2={VB_W - 16} y2="6" />
        <line x1={VB_W - 6} y1="6" x2={VB_W - 6} y2="16" />
        <line x1="6" y1={VB_H - 6} x2="16" y2={VB_H - 6} />
        <line x1="6" y1={VB_H - 6} x2="6" y2={VB_H - 16} />
        <line x1={VB_W - 6} y1={VB_H - 6} x2={VB_W - 16} y2={VB_H - 6} />
        <line x1={VB_W - 6} y1={VB_H - 6} x2={VB_W - 6} y2={VB_H - 16} />
      </g>
      <path d={path} fill="none" stroke={ink} strokeOpacity="0.2" strokeWidth={baseStroke * 1.6} strokeLinecap="round" />
      {visiblePath && <path className="motion-path" d={visiblePath} fill="none" stroke={ink} strokeWidth={baseStroke} strokeLinecap="round" />}
      {points.map((point, index) => {
        if (
          index === 0 ||
          index === points.length - 1 ||
          (progress !== undefined && (point.t ?? 0) > progress)
        ) return null;
        const prev = points[index - 1];
        const next = points[index + 1];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const length = Math.hypot(dx, dy) || 1;
        const nx = -dy / length;
        const ny = dx / length;
        const tick = point.dyno ? 12 : index % 3 === 0 ? 4 : 2;
        return (
          <line
            key={index}
            className="motion-vector"
            x1={point.x - nx * tick}
            y1={point.y - ny * tick}
            x2={point.x + nx * tick}
            y2={point.y + ny * tick}
            stroke={point.dyno ? accent : ink}
            strokeOpacity={point.dyno ? 1 : 0.55}
            strokeWidth={point.dyno ? 1.2 : 0.5}
          />
        );
      })}
      {cruxPoint && <CruxMark point={cruxPoint} accent={accent} ink={ink} data />}
      {points[0] && <circle cx={points[0].x} cy={points[0].y} r="3" fill="none" stroke={ink} strokeWidth="1" />}
      {progress === undefined && points[points.length - 1] && (
        <rect x={points[points.length - 1].x - 4} y={points[points.length - 1].y - 4} width="8" height="8" fill="none" stroke={accent} />
      )}
      {progress !== undefined && visiblePoints.length > 1 && (
        <circle cx={cruxPoint?.x ?? visiblePoints[visiblePoints.length - 1].x} cy={cruxPoint?.y ?? visiblePoints[visiblePoints.length - 1].y} r="2.2" fill={accent} />
      )}
    </g>
  );
}

function DynamicSignature({
  points,
  path,
  visiblePath,
  ink,
  accent,
  baseStroke,
  cruxPoint,
  animate,
  progress,
}: {
  points: MotionPoint[];
  path: string;
  visiblePath: string;
  ink: string;
  accent: string;
  baseStroke: number;
  cruxPoint?: MotionPoint;
  animate: boolean;
  progress?: number;
}) {
  return (
    <g className={animate ? 'signature-draw' : undefined}>
      {cruxPoint && <circle cx={cruxPoint.x} cy={cruxPoint.y} r="36" fill={accent} opacity="0.16" filter="url(#klymBlur)" />}
      <path
        d={path}
        fill="none"
        stroke={ink}
        strokeOpacity={progress === undefined ? 0.08 : 0.03}
        strokeWidth={baseStroke * 6}
        strokeLinecap="round"
        filter="url(#klymBlur)"
      />
      {progress === undefined && points.slice(0, -1).map((point, index) => {
        const next = points[index + 1];
        const width = baseStroke + (point.velocity || 0.2) * 4 + (point.dyno || next.dyno ? 6 : 0);
        const segmentProgress =
          progress === undefined
            ? undefined
            : clamp((progress - (point.t ?? 0)) / Math.max(0.001, (next.t ?? 1) - (point.t ?? 0)), 0, 1);
        return (
          <path
            key={index}
            className="motion-segment"
            pathLength={1}
            d={`M ${point.x} ${point.y} L ${next.x} ${next.y}`}
            fill="none"
            stroke={point.dyno || next.dyno ? accent : ink}
            strokeWidth={width}
            strokeLinecap="round"
            opacity={point.dyno || next.dyno ? 1 : 0.95}
            style={pathProgressStyle(segmentProgress)}
          />
        );
      })}
      {progress !== undefined && visiblePath && (
        <>
          <path
            className="motion-path"
            d={visiblePath}
            fill="none"
            stroke={ink}
            strokeWidth={baseStroke * 2.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.94"
          />
          <path
            d={visiblePath}
            fill="none"
            stroke={accent}
            strokeOpacity="0.8"
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(3,0)"
          />
        </>
      )}
      <path
        d={progress === undefined ? path : visiblePath}
        fill="none"
        stroke={accent}
        strokeOpacity="0.26"
        strokeWidth="0.7"
        strokeLinecap="round"
        transform="translate(3,0)"
      />
      {cruxPoint && <CruxMark point={cruxPoint} accent={accent} ink={ink} />}
    </g>
  );
}

function RefinedSignature({
  points,
  path,
  visiblePath,
  ink,
  accent,
  baseStroke,
  cruxPoint,
  minorPoint,
  animate,
  progress,
}: {
  points: MotionPoint[];
  path: string;
  visiblePath: string;
  ink: string;
  accent: string;
  baseStroke: number;
  cruxPoint?: MotionPoint;
  minorPoint?: MotionPoint;
  animate: boolean;
  progress?: number;
}) {
  return (
    <g className={animate ? 'signature-draw' : undefined}>
      <path d={path} fill="none" stroke={ink} strokeOpacity="0.08" strokeWidth={baseStroke * 1.4} strokeLinecap="round" transform="translate(2,3)" />
      <path d={path} fill="none" stroke={ink} strokeOpacity="0.18" strokeWidth="0.7" strokeDasharray="1 3" />
      {visiblePath && <path className="motion-path" d={visiblePath} fill="none" stroke={ink} strokeWidth={baseStroke} strokeLinecap="round" strokeLinejoin="round" />}
      {cruxPoint && <CruxMark point={cruxPoint} accent={accent} ink={ink} refined />}
      {minorPoint && (progress === undefined || (minorPoint.t ?? 0) <= progress) && <circle cx={minorPoint.x} cy={minorPoint.y} r="2.4" fill="none" stroke={accent} strokeWidth="0.8" />}
      {progress !== undefined && points.length > 1 && cruxPoint && <circle cx={cruxPoint.x} cy={cruxPoint.y} r="2.2" fill={accent} />}
    </g>
  );
}

function EditorialSignature({
  points,
  path,
  visiblePath,
  ink,
  accent,
  baseStroke,
  cruxPoint,
  animate,
  progress,
}: {
  points: MotionPoint[];
  path: string;
  visiblePath: string;
  ink: string;
  accent: string;
  baseStroke: number;
  cruxPoint?: MotionPoint;
  animate: boolean;
  progress?: number;
}) {
  return (
    <g className={animate ? 'signature-draw' : undefined}>
      <path d={visiblePath || path} fill="none" stroke={accent} strokeOpacity="0.2" strokeWidth={baseStroke * 7} strokeLinecap="round" filter="url(#klymBlur)" transform="translate(-3,4)" />
      <path d={visiblePath || path} fill="none" stroke={ink} strokeOpacity="0.22" strokeWidth={baseStroke * 4} strokeLinecap="round" filter="url(#klymBlur)" />
      {visiblePath && <path className="motion-path" d={visiblePath} fill="none" stroke={ink} strokeWidth={baseStroke * 0.9} strokeLinecap="round" strokeLinejoin="round" />}
      <path d={visiblePath || path} fill="none" stroke={accent} strokeOpacity="0.42" strokeWidth="0.6" strokeLinecap="round" transform="translate(4,-2)" />
      {cruxPoint && <CruxMark point={cruxPoint} accent={accent} ink={ink} />}
      {progress !== undefined && points.length > 1 && cruxPoint && <circle cx={cruxPoint.x} cy={cruxPoint.y} r="2.2" fill={accent} />}
    </g>
  );
}

function pathProgressStyle(progress?: number): CSSProperties | undefined {
  if (progress === undefined) return undefined;
  return {
    strokeDasharray: 1,
    strokeDashoffset: 1 - clamp(progress, 0, 1),
  };
}

function CruxMark({
  point,
  accent,
  ink,
  data,
  refined,
}: {
  point: MotionPoint;
  accent: string;
  ink: string;
  data?: boolean;
  refined?: boolean;
}) {
  const labelX = clamp(point.x + 16, 10, VB_W - 46);
  const labelY = clamp(point.y - 18, 12, VB_H - 10);

  if (data) {
    return (
      <g className="signature-crux-mark">
        <circle cx={point.x} cy={point.y} r="28" fill={accent} opacity="0.14" filter="url(#klymBlur)" />
        <g stroke={accent} strokeWidth="1" fill="none">
          <path d={`M ${point.x - 18} ${point.y - 12} L ${point.x - 18} ${point.y - 18} L ${point.x - 12} ${point.y - 18}`} />
          <path d={`M ${point.x + 18} ${point.y - 12} L ${point.x + 18} ${point.y - 18} L ${point.x + 12} ${point.y - 18}`} />
          <path d={`M ${point.x - 18} ${point.y + 12} L ${point.x - 18} ${point.y + 18} L ${point.x - 12} ${point.y + 18}`} />
          <path d={`M ${point.x + 18} ${point.y + 12} L ${point.x + 18} ${point.y + 18} L ${point.x + 12} ${point.y + 18}`} />
        </g>
        <circle cx={point.x} cy={point.y} r="3" fill={accent} />
        <line x1={point.x + 10} y1={point.y - 10} x2={labelX - 4} y2={labelY - 4} stroke={accent} strokeWidth="0.6" />
        <text x={labelX} y={labelY} className="signature-microtext" fill={accent}>
          CRUX
        </text>
      </g>
    );
  }

  return (
    <g className="signature-crux-mark">
      <circle cx={point.x} cy={point.y} r={refined ? 22 : 30} fill={accent} opacity={refined ? 0.12 : 0.16} filter="url(#klymBlur)" />
      <circle cx={point.x} cy={point.y} r={refined ? 3.5 : 5} fill={accent} />
      <circle cx={point.x} cy={point.y} r={refined ? 8 : 12} fill="none" stroke={accent} strokeWidth="1" opacity="0.65" />
      <line x1={point.x + 7} y1={point.y - 7} x2={labelX - 4} y2={labelY - 4} stroke={accent} strokeWidth="0.6" opacity="0.8" />
      <text x={labelX} y={labelY} className="signature-microtext" fill={refined ? ink : accent}>
        CRUX
      </text>
    </g>
  );
}

function maxVelocityPoint(points: MotionPoint[]) {
  return points.reduce<MotionPoint | undefined>((best, point) => {
    if (!best || (point.velocity || 0) > (best.velocity || 0)) return point;
    return best;
  }, undefined);
}

function activeSpotlightPoint(points: MotionPoint[], cruxPoints: MotionPoint[], progress?: number) {
  if (progress !== undefined) return motionPointAtProgress(points, progress) || cruxPoints[0] || maxVelocityPoint(points);
  return cruxPoints[0] || maxVelocityPoint(points);
}
