import { parseBlocks, soloLink, splitInline } from './richcore.js';

const Nodes = ({ list }) => list.map((n, i) => {
  if (n.t === 'link') return <a key={i} href={n.href} target="_blank" rel="noopener noreferrer">{n.label}</a>;
  if (n.t === 'b') return <strong key={i}><Nodes list={n.children} /></strong>;
  if (n.t === 'i') return <em key={i}><Nodes list={n.children} /></em>;
  return <span key={i}>{n.v}</span>;
});
const Inline = ({ text }) => <Nodes list={splitInline(text)} />;

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
