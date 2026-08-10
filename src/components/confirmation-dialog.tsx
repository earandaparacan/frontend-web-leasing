"use client";

import { useEffect, useRef } from "react";
import styles from "./confirmation-dialog.module.css";

type ConfirmationDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  isOpen,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    confirmButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
      if (event.key !== "Tab") return;

      const buttons = [cancelButtonRef.current, confirmButtonRef.current].filter(
        (button): button is HTMLButtonElement => button !== null,
      );
      const currentButton = document.activeElement instanceof HTMLButtonElement
        ? document.activeElement
        : null;
      const currentIndex = currentButton ? buttons.indexOf(currentButton) : -1;
      if (currentIndex === -1) return;
      const nextIndex = event.shiftKey
        ? (currentIndex - 1 + buttons.length) % buttons.length
        : (currentIndex + 1) % buttons.length;
      event.preventDefault();
      buttons[nextIndex].focus();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={onCancel}>
      <section
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className={styles.icon} aria-hidden="true">!</span>
        <div>
          <h2 id="confirmation-dialog-title">{title}</h2>
          <p id="confirmation-dialog-description">{description}</p>
        </div>
        <div className={styles.actions}>
          <button ref={cancelButtonRef} className={styles.cancelButton} type="button" onClick={onCancel}>Cancelar</button>
          <button ref={confirmButtonRef} className={styles.confirmButton} type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
