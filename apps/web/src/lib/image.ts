export async function shrink(file: File, max = 1400): Promise<Blob> {
  const img = await createImageBitmap(file); const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = img.width * s; c.height = img.height * s;
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.85));
}
