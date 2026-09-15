import { useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IMAGE_MODELS, isImageModelId, type ImageModelId } from "@/lib/image-models";

export type ModelSelectorProps = {
  selectedModel: ImageModelId;
  onModelChange: (model: ImageModelId) => void;
};

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">Image model</label>
      <Select
        value={selectedModel}
        onValueChange={(value) => {
          if (isImageModelId(value)) onModelChange(value);
        }}
      >
        <SelectTrigger id={id} className="h-11 gap-2 rounded-xl bg-background px-3 shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {IMAGE_MODELS.map((option) => (
            <SelectItem key={option.id} value={option.id} className="rounded-lg py-2 pl-3">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
