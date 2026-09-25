import { NumberInput } from './NumberInput';

export interface Vector4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Vector4InputProps {
  label?: string;
  value: Vector4;
  onChange?: (val: Vector4) => void;
  step?: number;
  class?: string;
}

export function Vector4Input(props: Vector4InputProps) {
  const updateAxis = (axis: 'x' | 'y' | 'z' | 'w', val: number) => {
    props.onChange?.({
      ...props.value,
      [axis]: val,
    });
  };

  return (
    <div class={`space-y-1 select-none ${props.class || ''}`}>
      {props.label && (
        <span class="text-md text-[var(--text-muted)] font-mono uppercase block">
          {props.label}
        </span>
      )}
      <div class="grid grid-cols-4 gap-1">
        <NumberInput
          prefix="X"
          prefixColor="#ef4444"
          value={props.value.x}
          onChange={(v) => updateAxis('x', v)}
          step={props.step ?? 0.05}
        />
        <NumberInput
          prefix="Y"
          prefixColor="#22c55e"
          value={props.value.y}
          onChange={(v) => updateAxis('y', v)}
          step={props.step ?? 0.05}
        />
        <NumberInput
          prefix="Z"
          prefixColor="#3b82f6"
          value={props.value.z}
          onChange={(v) => updateAxis('z', v)}
          step={props.step ?? 0.05}
        />
        <NumberInput
          prefix="W"
          prefixColor="#eab308"
          value={props.value.w}
          onChange={(v) => updateAxis('w', v)}
          step={props.step ?? 0.05}
        />
      </div>
    </div>
  );
}
