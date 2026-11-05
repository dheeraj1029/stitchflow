import { useId } from "react";

export default function Card({ children, className = "", title }) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={`card ${className}`.trim()}
    >
      {title && (
        <h2 className="card__title" id={titleId}>
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
