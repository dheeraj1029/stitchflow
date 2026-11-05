export default function PageHeader({ title, description }) {
  return (
    <header className="page-header">
      <h1 className="page-header__title">{title}</h1>
      {description && <p className="page-header__description">{description}</p>}
    </header>
  );
}
