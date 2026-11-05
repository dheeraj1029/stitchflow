import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import Button from "./Button.jsx";

export default function ModalDialog({ children, onClose, open, title }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  return (
    <dialog
      aria-labelledby={titleId}
      className="modal-dialog"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="modal-dialog__header">
        <h2 className="modal-dialog__title" id={titleId}>
          {title}
        </h2>
        <Button
          aria-label="Close dialog"
          className="modal-dialog__close"
          onClick={onClose}
          variant="quiet"
        >
          <X aria-hidden="true" size={19} />
        </Button>
      </div>
      <div className="modal-dialog__content">{children}</div>
    </dialog>
  );
}
