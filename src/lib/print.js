export function printDocument(mode) {
  const className = `printing-${mode}`;
  const clear = () => document.body.classList.remove(className);
  document.body.classList.add(className);
  window.addEventListener("afterprint", clear, { once: true });
  requestAnimationFrame(() => window.setTimeout(() => window.print(), 80));
}
