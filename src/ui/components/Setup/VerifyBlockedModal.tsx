import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

/**
 * Shown when Verify is clicked while the terminal is not in the exercise
 * folder. Closing restores the lesson page so they can click Start Exercise.
 */
export const VerifyBlockedModal = ({ onClose }: { onClose: () => void }) => (
  <Modal opened onClose={onClose} title="Not in the exercise folder" size="sm">
    <div className="flex flex-col gap-4 text-sm text-fg">
      <p>
        You are not in the correct exercise folder. Click Start Exercise first.
      </p>
      <div className="flex justify-end">
        <Button onClick={onClose}>OK</Button>
      </div>
    </div>
  </Modal>
);
