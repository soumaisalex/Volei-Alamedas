// Seleção de pessoa: foto em cima, nome embaixo (a fonte diminui conforme o tamanho do nome).
export const nameSize = (n) => (n.length <= 9 ? '1rem' : n.length <= 12 ? '.88rem' : n.length <= 16 ? '.78rem' : '.7rem');

export default function Person({ name, photo_url, className = '', children, ...rest }) {
  return (
    <button type="button" className={`card pick ${className}`.trim()} {...rest}>
      {photo_url ? <img className="avatar" src={photo_url} alt="" /> : <span className="avatar">{name[0]}</span>}
      <span className="nm" style={{ fontSize: nameSize(name) }}>{name}</span>
      {children}
    </button>
  );
}
