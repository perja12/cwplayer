export function modalElement(): HTMLDialogElement {
  return document.querySelector<HTMLDialogElement>("#modal")!;
}

export function openModal(className: string, html: string): HTMLDialogElement {
  const modal = modalElement();
  modal.className = `modal ${className}`;
  modal.innerHTML = html;
  modal.showModal();
  return modal;
}
