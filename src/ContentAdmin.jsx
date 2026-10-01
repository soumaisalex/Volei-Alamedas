import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import RichText from './richtext.jsx';
import { ITEMS } from './InfoCards.jsx';

function Editor({ api, item, initial, onSaved, onClose }) {
  const [text, setText] = useState(initial);
  const [preview, setPreview] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ta = useRef(null);
  // Envolve o trecho selecionado (ou um "texto" de exemplo) com o marcador.
  const wrap = (mk) => {
    const el = ta.current;
    if (!el) return;
    const a = el.selectionStart, b = el.selectionEnd;
    const sel = text.slice(a, b) || 'texto';
    setText(text.slice(0, a) + mk + sel + mk + text.slice(b));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + mk.length, a + mk.length + sel.length); });
  };
  const add = (snippet) => setText((t) => `${t}${t && !t.endsWith('\n') ? '\n' : ''}${snippet}`);
  const nextNumber = () => {
    const last = text.trimEnd().split('\n').pop() || '';
    const m = /^\s*(\d+)[.)]\s/.exec(last);
    return m ? Number(m[1]) + 1 : 1;
  };
  const save = async () => {
    setSaving(true); setErr('');
    try { await api('/content', { body: { key: item[0], body: text } }); onSaved(item[0], text); onClose(); }
    catch (e) { setErr(e.message); setSaving(false); }
  };

  return (
    <div className="overlay" role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Editar ${item[1]}`}>
        <h3>{item[1]}</h3>
        {err && <p className="err" role="alert">{err}</p>}
        {preview ? (
          text.trim() ? <RichText text={text} asLinks={item[0] === 'links'} /> : <p className="muted">Nada escrito ainda.</p>
        ) : (
          <textarea ref={ta} rows={10} maxLength={5000} aria-label={item[1]} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={'Escreva um item por linha.\n1. Primeiro item\n- Marcador\n"Google"[https://www.google.com]\n*negrito* e _itálico_'} />
        )}
        {!preview && (
          <div className="chips">
            <button className="chip" onClick={() => wrap('*')}><strong>N</strong> Negrito</button>
            <button className="chip" onClick={() => wrap('_')}><em>I</em> Itálico</button>
            <button className="chip" onClick={() => add('- ')}>Marcador</button>
            <button className="chip" onClick={() => add(`${nextNumber()}. `)}>Numeração</button>
            <button className="chip" onClick={() => add('"Texto do link"[https://]')}>Link</button>
          </div>
        )}
        <p className="muted">Use “1. ” para numeração, “- ” para marcadores e “Texto”[endereço] para links, *negrito* e _itálico_ para destacar. O resto vira parágrafo. {text.length}/5000</p>
        <button className="btn" onClick={() => setPreview(!preview)}>{preview ? 'Voltar a editar' : 'Ver como fica'}</button>
        <button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Salvando…' : 'Salvar'}</button>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

// Seção do perfil do admin: edita os textos das 3 janelas da tela inicial.
export default function ContentAdmin({ api }) {
  const [data, setData] = useState({});
  const [edit, setEdit] = useState(null);
  useEffect(() => { api('/content').then(setData).catch(() => {}); }, [api]);
  const item = ITEMS.find(([k]) => k === edit);

  return (
    <section>
      <h3>Conteúdo da tela inicial</h3>
      <p className="muted">Toque para editar os textos de Informações, Links e Regras.</p>
      <div className="info-row">
        {ITEMS.map(([k, label, icon]) => (
          <button key={k} className="card info" onClick={() => setEdit(k)}><Icon name={icon} /><span>{label}</span></button>
        ))}
      </div>
      {item && <Editor key={edit} api={api} item={item} initial={data[edit] || ''} onSaved={(k, v) => setData({ ...data, [k]: v })} onClose={() => setEdit(null)} />}
    </section>
  );
}
