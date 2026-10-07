import { useEffect, useState } from 'react';

// Gera o QR fixo de check-in (no próprio navegador) para baixar ou imprimir como cartaz.
export default function QrAdmin() {
  const url = `${window.location.origin}/checkin`;
  const [src, setSrc] = useState('');
  const [err, setErr] = useState('');
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (!opened) return undefined;
    let alive = true;
    import('qrcode')
      .then((m) => (m.default ?? m).toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: 'M' }))
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setErr('Não foi possível gerar o QR.'));
    return () => { alive = false; };
  }, [url, opened]);

  return (
    <details className="card" onToggle={(e) => e.currentTarget.open && setOpened(true)}>
      <summary><span className="grow">QR de check-in</span></summary>
      <p className="muted">Imprima e deixe na entrada da quadra. Ao escanear, a pessoa entra com o nome e o check-in do evento em andamento é feito sozinho. O QR é fixo, não precisa trocar.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="qr-box">{src ? <img src={src} alt="QR code de check-in" /> : <p className="muted">Gerando…</p>}</div>
      <p className="muted center">{url}</p>
      {src && (
        <div className="stack">
          <a className="btn" href={src} download="qr-checkin-volei.png">Baixar imagem</a>
          <button className="btn" onClick={() => window.print()}>Imprimir cartaz</button>
        </div>
      )}

      <div className="poster" aria-hidden="true">
        <img className="poster-logo" src="/logo.png" alt="" />
        <h1>Check-in</h1>
        {src && <img className="poster-qr" src={src} alt="" />}
        <ol>
          <li>Aponte a câmera do celular para o QR.</li>
          <li>Entre com o seu nome.</li>
          <li>Pronto: o seu check-in é feito sozinho.</li>
        </ol>
        <p>Vôlei Alamedas Jardins</p>
      </div>
    </details>
  );
}
