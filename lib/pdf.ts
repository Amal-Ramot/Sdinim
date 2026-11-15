// Save the fitted one-page print layout as a real PDF file (no print dialog).
// The page is rendered by the browser itself (SVG foreignObject), so Hebrew,
// colors and the fit-to-page scaling look exactly like the print preview.

export async function savePagePdf(page: HTMLElement, size: { w: number; h: number }, fileName: string) {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const opts = { pixelRatio: 3, backgroundColor: "#ffffff", cacheBust: true };
  let canvas: HTMLCanvasElement;
  try {
    canvas = await toCanvas(page, opts);
  } catch {
    // Web fonts could not be embedded (e.g. offline) — fall back to system fonts.
    canvas = await toCanvas(page, { ...opts, skipFonts: true });
  }
  const pdf = new jsPDF({
    orientation: size.w > size.h ? "landscape" : "portrait",
    unit: "mm",
    format: [size.w, size.h],
    compress: true,
  });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, size.w, size.h, undefined, "FAST");
  const url = URL.createObjectURL(pdf.output("blob"));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
