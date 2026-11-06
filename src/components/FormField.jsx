export default function FormField({
  children,
  error,
  hint,
  id,
  label,
  required = false,
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={`form-field${error ? " form-field--invalid" : ""}`}>
      <label className="form-field__label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && (
        <span className="form-field__hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="form-field__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
