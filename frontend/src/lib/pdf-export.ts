/**
 * Exportación a PDF: abre el diálogo de impresión del navegador con el
 * contenido del reporte (Guardar como PDF).
 */
export function exportElementToPdf(element: HTMLElement | null, title: string) {
  if (!element || typeof window === "undefined") return;
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) return;

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => n.outerHTML)
    .join("");

  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8" />
    <title>${title}</title>${styles}
    <style>
      @page { margin: 16mm; }
      body { background: #fff; padding: 0; }
      .no-print { display: none !important; }
    </style>
  </head><body class="bg-background text-foreground">
    <h1 style="font-size:20px;font-weight:800;margin-bottom:16px">${title}</h1>
    ${element.innerHTML}
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 400);
}
