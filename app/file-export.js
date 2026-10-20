// Android WebView cannot save blob: downloads; use its explicit system document picker.
export async function saveFile(blob, name) {
  const native = globalThis.Capacitor;
  if (native?.getPlatform() === 'android') {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(Error('读取导出文件失败'));
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.readAsDataURL(blob);
    });
    const exporter = native.Plugins?.ExportFile;
    if (!exporter?.save) throw Error('当前应用无法保存文件，请更新应用后重试');
    return exporter.save({ name, mime: blob.type || 'application/octet-stream', data });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
