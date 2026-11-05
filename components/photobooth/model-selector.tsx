import { useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  IMAGE_COMPLEXITIES,
  IMAGE_MODELS,
  isImageComplexity,
  isImageModelId,
  supportsImageComplexity,
  type ImageComplexity,
  type ImageModelId,
} from "@/lib/image-models";

export type ModelSelectorProps = {
  selectedModel: ImageModelId;
  onModelChange: (model: ImageModelId) => void;
  selectedComplexity: ImageComplexity;
  onComplexityChange: (complexity: ImageComplexity) => void;
};

export function ModelSelector({
  selectedModel,
  onModelChange,
  selectedComplexity,
  onComplexityChange,
}: ModelSelectorProps) {
  const id = useId();
  const complexityId = useId();

  return (
    <div className="flex flex-col gap-4">
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
      {supportsImageComplexity(selectedModel) ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={complexityId} className="text-sm font-medium">Complexity</label>
          <Select
            value={selectedComplexity}
            onValueChange={(value) => {
              if (isImageComplexity(value)) onComplexityChange(value);
            }}
          >
            <SelectTrigger id={complexityId} className="h-11 gap-2 rounded-xl bg-background px-3 shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {IMAGE_COMPLEXITIES.map((complexity) => (
                <SelectItem key={complexity} value={complexity} className="rounded-lg py-2 pl-3">
                  {complexity[0].toUpperCase() + complexity.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
