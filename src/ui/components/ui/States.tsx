import { cx } from "../../utils/cx";
import { Spinner } from "./Spinner";

export const LoadingState = ({
  message,
  className,
}: {
  message: string;
  className?: string;
}) => (
  <div
    className={cx(
      "flex h-full w-full flex-col items-center justify-center gap-2",
      className,
    )}
  >
    <Spinner size={24} />
    <p className="text-[13px] text-muted">{message}</p>
  </div>
);
