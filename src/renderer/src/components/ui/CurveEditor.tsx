import { createSignal, For } from 'solid-js';

export interface CurvePoint {
  id: string;
  x: number; // 0 to 1
  y: number; // 0 to 1
}

export interface CurveEditorProps {
  label?: string;
  points?: CurvePoint[];
  onChange?: (points: CurvePoint[]) => void;
  class?: string;
}

export function CurveEditor(props: CurveEditorProps) {
  const [points] = createSignal<CurvePoint[]>(
    props.points || [
      { id: 'p0', x: 0.0, y: 0.0 },
      { id: 'p1', x: 0.25, y: 0.1 },
      { id: 'p2', x: 0.75, y: 0.9 },
      { id: 'p3', x: 1.0, y: 1.0 },
    ]
  );
  const [selectedPointId, setSelectedPointId] = createSignal<string>('p1');

  // Generate SVG Cubic Bezier Path
  const svgPath = () => {
    const pts = points();
    if (pts.length < 2) return '';
    const toSvg = (p: CurvePoint) => ({ x: p.x * 200, y: (1 - p.y) * 120 });
    const p0 = toSvg(pts[0]);
    const p1 = toSvg(pts[1]);
    const p2 = toSvg(pts[2]);
    const p3 = toSvg(pts[3]);
    return `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;
  };

  return (
    <div class={`flex flex-col gap-1.5 select-none ${props.class || ''}`}>
      <div class="flex items-center justify-between text-md">
        {props.label && <span class="text-[var(--text-main)] font-semibold">{props.label}</span>}
        <span class="text-md font-mono text-[var(--accent-color)]">Cubic Bezier Easing</span>
      </div>

      <div class="w-full h-32 bg-black/60 border border-[var(--border-color)] rounded-[2px] relative overflow-hidden flex items-center justify-center">
        {/* Subtle 4x4 Grid Lines */}
        <div class="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none opacity-15">
          {Array.from({ length: 16 }).map(() => (
            <div class="border border-white/40" />
          ))}
        </div>

        {/* Linear 45-degree Reference Line */}
        <svg class="absolute inset-0 w-full h-full pointer-events-none stroke-white/10 stroke-1" viewBox="0 0 200 120">
          <line x1="0" y1="120" x2="200" y2="0" stroke-dasharray="2 2" />
        </svg>

        {/* Interactive Spline Curve */}
        <svg class="w-full h-full relative" viewBox="0 0 200 120">
          <path
            d={svgPath()}
            stroke="var(--accent-color)"
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
          />

          {/* Tangent Handle Line */}
          <line
            x1={points()[0].x * 200}
            y1={(1 - points()[0].y) * 120}
            x2={points()[1].x * 200}
            y2={(1 - points()[1].y) * 120}
            stroke="rgba(255,255,255,0.3)"
            stroke-width="1"
          />
          <line
            x1={points()[3].x * 200}
            y1={(1 - points()[3].y) * 120}
            x2={points()[2].x * 200}
            y2={(1 - points()[2].y) * 120}
            stroke="rgba(255,255,255,0.3)"
            stroke-width="1"
          />

          {/* Control Point Handles */}
          <For each={points()}>
            {(pt) => {
              const isSelected = () => selectedPointId() === pt.id;
              return (
                <circle
                  cx={pt.x * 200}
                  cy={(1 - pt.y) * 120}
                  r={isSelected() ? 5 : 3.5}
                  class={`cursor-pointer transition-all ${
                    isSelected() ? 'fill-[var(--accent-color)] stroke-white stroke-2' : 'fill-white stroke-black stroke-1'
                  }`}
                  onClick={() => setSelectedPointId(pt.id)}
                />
              );
            }}
          </For>
        </svg>
      </div>
    </div>
  );
}
