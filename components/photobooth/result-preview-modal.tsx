import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResultPreviewState } from "@/types/photobooth";

type ResultPreviewModalProps = {
  modalState: ResultPreviewState;
  onClose: () => void;
  onDownload: () => void;
};

export const ResultPreviewModal = ({
  modalState,
  onClose,
  onDownload,
}: ResultPreviewModalProps) => {
  if (!modalState) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label={`${modalState.label} preview`}
      onClick={onClose}
    >
      <div
        className="absolute inset-x-4 top-4 z-10 flex items-center justify-between md:inset-x-8"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md md:text-base">
          {modalState.label}
        </p>
        <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/35 p-1.5 backdrop-blur-md">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-full px-3 text-white hover:bg-white/15 hover:text-white"
            onClick={onDownload}
          >
            <Download data-icon="inline-start" />
            Download
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full text-white hover:bg-white/15 hover:text-white"
            onClick={onClose}
            aria-label="Close preview"
          >
            <X />
          </Button>
        </div>
      </div>

      <div className="flex h-full w-full items-center justify-center p-4 pt-20 md:p-10 md:pt-24">
        <div
          className="flex max-h-full max-w-full items-center justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          <img
            src={modalState.imageUrl}
            alt={`${modalState.label} full preview`}
            className="max-h-[calc(100svh-8rem)] max-w-[calc(100vw-2rem)] rounded-xl object-contain shadow-2xl md:max-h-[calc(100svh-10rem)] md:max-w-[calc(100vw-5rem)]"
          />
        </div>
      </div>
    </div>
  );
};

