import { createSignal } from 'solid-js';
import { UploadCloud, FileCheck } from 'lucide-solid';

export interface FileDropzoneProps {
  label?: string;
  accept?: string;
  onFileSelect?: (file: File) => void;
  class?: string;
}

export function FileDropzone(props: FileDropzoneProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const [fileName, setFileName] = createSignal<string | null>(null);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsHovered(false);
    if (e.dataTransfer?.files.length) {
      const file = e.dataTransfer.files[0];
      setFileName(file.name);
      props.onFileSelect?.(file);
    }
  };

  return (
    <div class={`space-y-1 select-none ${props.class || ''}`}>
      {props.label && (
        <span class="text-md text-[var(--text-muted)] font-mono uppercase block">
          {props.label}
        </span>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setIsHovered(true); }}
        onDragLeave={() => setIsHovered(false)}
        onDrop={handleDrop}
        class={`border-2 border-dashed rounded-[3px] p-4 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5 ${
          isHovered()
            ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10'
            : 'border-[var(--border-color)] bg-black/20 hover:border-white/30 hover:bg-white/5'
        }`}
      >
        {fileName() ? (
          <div class="flex items-center gap-2 text-green-400">
            <FileCheck size={16} />
            <span class="font-mono text-md font-bold">{fileName()}</span>
          </div>
        ) : (
          <>
            <UploadCloud size={18} class="text-[var(--accent-color)]" />
            <div class="text-md font-bold text-white">
              Drag & Drop 3D Model / Asset
            </div>
            <div class="text-md font-mono text-[var(--text-muted)]">
              Accepted: {props.accept || '.FBX, .OBJ, .GLTF, .EXR, .BLEND'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
