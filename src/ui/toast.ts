export function showToast(message: string) {
  const node = document.querySelector<HTMLDivElement>("#toast");
  if (!node) return;
  node.textContent = message;
  node.hidden = false;
  setTimeout(() => {
    if (node.isConnected) node.hidden = true;
  }, 2500);
}
