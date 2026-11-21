// Dependency-free PDF writer (A5, built-in Helvetica). Used server-side so a real PDF is ALWAYS produced,
// with no headless browser. Text is WinAnsi: "₹" is written as "Rs." and unsupported characters become "?".
const W = 419.53, H = 595.28, M = 28; // A5 portrait in points
const clean = (s: unknown) => String(s ?? "").replace(/₹/g, "Rs.").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/•/g, "-").replace(/[^\x20-\x7E]/g, "?");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
// Approximate Helvetica advance widths (per 1000 em) — good enough for wrapping/alignment.
const cw = (c: string, bold: boolean) => ("iljI.,:;'|! ".includes(c) ? 278 : "frt()-[]/".includes(c) ? 333 : "mwMW@%".includes(c) ? 833 : /[A-Z0-9]/.test(c) ? 667 : 556) * (bold ? 1.05 : 1) / 1000;
export const textWidth = (s: string, size: number, bold = false) => [...clean(s)].reduce((a, c) => a + cw(c, bold), 0) * size;

export class Pdf {
  private pages: string[] = []; private cur = ""; y = H - M;
  constructor() { this.add(); }
  private add() { if (this.cur) this.pages.push(this.cur); this.cur = ""; this.y = H - M; }
  private ensure(h: number) { if (this.y - h < M + 14) this.add(); }
  text(s: unknown, x: number, y: number, size = 9, bold = false, align: "l" | "r" | "c" = "l") {
    const t = clean(s); const w = textWidth(t, size, bold);
    const px = align === "r" ? x - w : align === "c" ? x - w / 2 : x;
    this.cur += `BT /${bold ? "F2" : "F1"} ${size} Tf ${px.toFixed(2)} ${y.toFixed(2)} Td (${esc(t)}) Tj ET\n`;
  }
  rule(y = this.y, gray = 0.7) { this.cur += `${gray} G 0.6 w ${M} ${y.toFixed(2)} m ${W - M} ${y.toFixed(2)} l S\n`; }
  fill(x: number, y: number, w: number, h: number, g: number) { this.cur += `${g} g ${x} ${y} ${w} ${h} re f 0 g\n`; }
  gap(n = 6) { this.y -= n; }
  wrap(s: unknown, width: number, size: number, bold = false): string[] {
    const out: string[] = []; let line = "";
    for (const word of clean(s).split(/\s+/).filter(Boolean)) {
      const t = line ? `${line} ${word}` : word;
      if (textWidth(t, size, bold) <= width || !line) line = t; else { out.push(line); line = word; }
    }
    if (line) out.push(line); return out.length ? out : [""];
  }
  line(s: unknown, size = 9, bold = false, align: "l" | "r" | "c" = "l") {
    for (const l of this.wrap(s, W - 2 * M, size, bold)) { this.ensure(size + 3); this.y -= size + 1; this.text(l, align === "r" ? W - M : align === "c" ? W / 2 : M, this.y, size, bold, align); this.y -= 2; }
  }
  pair(label: string, value: unknown, size = 9) { this.ensure(size + 4); this.y -= size + 2; this.text(label, M, this.y, size, true); this.text(value, M + 105, this.y, size); }
  // cols: [{w: fraction, a: alignment}] ; rows of strings
  table(head: string[], rows: unknown[][], cols: { w: number; a?: "l" | "r" | "c" }[], size = 8) {
    const tw = W - 2 * M; const xs: number[] = []; let acc = M; for (const c of cols) { xs.push(acc); acc += c.w * tw; }
    const draw = (cells: unknown[], bold: boolean, shade: boolean) => {
      const wrapped = cells.map((v, i) => this.wrap(v, cols[i].w * tw - 6, size, bold)); const n = Math.max(...wrapped.map((w) => w.length));
      const h = n * (size + 2) + 4; this.ensure(h); if (shade) this.fill(M, this.y - h, tw, h, 0.9);
      wrapped.forEach((ls, i) => ls.forEach((l, k) => { const a = cols[i].a ?? "l"; const x = a === "r" ? xs[i] + cols[i].w * tw - 3 : a === "c" ? xs[i] + cols[i].w * tw / 2 : xs[i] + 3; this.text(l, x, this.y - 2 - (k + 1) * (size + 2) + 3, size, bold, a); }));
      this.y -= h; this.rule(this.y, 0.85);
    };
    draw(head, true, true); rows.forEach((r) => draw(r, false, false));
  }
  build(footer?: string): Buffer {
    this.pages.push(this.cur); this.cur = "";
    const objs: string[] = []; const n = this.pages.length;
    objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objs[2] = `<< /Type /Pages /Kids [${this.pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ")}] /Count ${n} >>`;
    objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    this.pages.forEach((c, i) => {
      const foot = `BT /F1 7 Tf ${W / 2 - 30} 16 Td (${esc(clean(`${footer ? footer + "  |  " : ""}Page ${i + 1} of ${n}`))}) Tj ET\n`;
      const content = c + foot;
      objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
      objs[6 + i * 2] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream`;
    });
    let out = "%PDF-1.4\n"; const off: number[] = [];
    for (let i = 1; i < objs.length; i++) { off[i] = Buffer.byteLength(out, "latin1"); out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
    const x = Buffer.byteLength(out, "latin1");
    out += `xref\n0 ${objs.length}\n0000000000 65535 f \n${off.slice(1).map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
    return Buffer.from(out, "latin1");
  }
}
