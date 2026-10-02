import { AUTHOR, INSTAGRAM_URL } from './credits.js';

export default function Footer() {
  return (
    <footer className="credit">
      Desenvolvido por{' '}
      {INSTAGRAM_URL ? <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">{AUTHOR}</a> : AUTHOR}
    </footer>
  );
}
