import { IconCheck } from "@tabler/icons-react";
import type { ActivityFocusNotice } from "../../contexts/ActivityContext";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

const verifyCopy = {
  correct: {
    title: "Exercise answer correct",
    body: "Your solution passed verification.",
  },
  incorrect: {
    title: "Exercise answer incorrect",
    body: "Review the feedback in the terminal and try again.",
  },
  complete: {
    title: "Verification complete",
    body: "Review the verification output in the terminal.",
  },
  failed: {
    title: "Verification failed",
    body: "Review the error in the terminal and try again.",
  },
} as const;

export const ActivityFeedbackModal = ({
  notice,
  onClose,
}: {
  notice: ActivityFocusNotice;
  onClose: () => void;
}) => {
  const downloadingLabel =
    notice.kind === "start" && notice.activityKind === "hands-on"
      ? "Downloading hands-on..."
      : "Downloading exercise...";

  if (notice.kind === "verify") {
    const copy = verifyCopy[notice.result];
    return (
      <Modal
        opened
        onClose={onClose}
        title={copy.title}
        size="sm"
        dimBackground={false}
        excludeWorkColumn
      >
        <div className="flex flex-col gap-4 text-sm text-fg">
          <p>{notice.message ?? copy.body}</p>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={onClose}
              leftIcon={<IconCheck size={15} />}
            >
              Continue
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title={`Starting ${notice.activityName}`}
      size="sm"
      dimBackground={false}
      excludeWorkColumn
    >
      <div className="flex flex-col gap-4 text-sm text-fg">
        <p className="font-semibold">
          Work on it in the terminal on the right.
        </p>
        {notice.activityKind === "exercise" && (
          <p>Click Verify to check your answer.</p>
        )}
        {notice.status === "failed" && (
          <p className="text-danger">
            {notice.message ?? "Could not start this activity."}
          </p>
        )}
        <div className="flex justify-end">
          {notice.status === "downloading" ? (
            <Button size="sm" loading>
              {downloadingLabel}
            </Button>
          ) : (
            <Button size="sm" onClick={onClose}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
