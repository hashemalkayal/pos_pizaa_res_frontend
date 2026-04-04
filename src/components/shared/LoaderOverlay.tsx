import type { FC } from "react";

type LoaderOverlayProps = {
  show: boolean;
};

const LoaderOverlay: FC<LoaderOverlayProps> = ({ show }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/30 flex items-center justify-center backdrop-blur-sm">
      <div className="flex flex-col gap-2">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />

        <h3 className="text-lg text-white">{"Loading ..."}</h3>
      </div>
    </div>
  );
};

export default LoaderOverlay;
