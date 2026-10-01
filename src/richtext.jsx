import { parseBlocks, soloLink, splitInline } from './richcore.js';

const Inline = ({ text }) => splitInline(text).map((p, i) =>
  p.t === 'link'
    ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer">{p.label}</a>
    : <span key={i}>{p.v}</span>);

export default function RichText({ text, asLinks = false }) {
  return (
    <div className="rich">
      {parseBlocks(text).map((b, i) => {
        if (b.type === 'ol') return <ol key={i} start={b.start}>{b.items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ol>;
        if (b.type === 'ul') return <ul key={i}>{b.items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ul>;
        const solo = asLinks && soloLink(b.items[0]);
        if (solo) return <a key={i} className="linkrow" href={solo.href} target="_blank" rel="noopener noreferrer">{solo.label}</a>;
        return <p key={i}><Inline text={b.items[0]} /></p>;
      })}
    </div>
  );
}
