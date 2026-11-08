// Recorta ao centro e reduz para um JPEG quadrado leve (~30 KB).
export async function toJpeg(file, size = 320) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const s = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('Não foi possível processar a foto.'))), 'image/jpeg', 0.85));
}
