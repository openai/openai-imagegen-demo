import { useId } from "react";
import { IMAGE_MODELS, type ImageModelId } from "@/lib/image-models";

export type ModelSelectorProps = {
  selectedModel: ImageModelId;
  onModelChange: (model: ImageModelId) => void;
};

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const id = useId();

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">Image model</label>
      <select
        id={id}
        value={selectedModel}
        onChange={(event) => onModelChange(event.target.value as ImageModelId)}
        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {IMAGE_MODELS.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}
