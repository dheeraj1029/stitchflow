import { forwardRef } from "react";

const Button = forwardRef(function Button(
  {
    children,
    className = "",
    variant = "secondary",
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      className={`button button--${variant} ${className}`.trim()}
      ref={ref}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
