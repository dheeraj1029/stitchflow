import { useEffect, useState } from "react";

const initialForm = {
  name: "",
  email: "",
  role: "SUPERVISOR",
  buyerOrganizationId: "",
  productionUnitId: "",
  password: "",
  isActive: true,
};

export default function UserForm({
  existingUser,
  organizations,
  productionUnits,
  onCancel,
  onSave,
  saving,
}) {
  const [values, setValues] = useState(initialForm);
  const [error, setError] = useState("");

  useEffect(() => {
    setValues(
      existingUser
        ? {
            ...initialForm,
            name: existingUser.name,
            email: existingUser.email,
            role: existingUser.role,
            buyerOrganizationId: existingUser.buyerOrganizationId || "",
            productionUnitId: existingUser.productionUnitId || "",
            isActive: existingUser.isActive,
          }
        : initialForm,
    );
    setError("");
  }, [existingUser]);

  function change(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (values.role === "BUYER" && !values.buyerOrganizationId) {
      setError("Choose the buyer organization for this account.");
      return;
    }
    if (values.role === "SUPERVISOR" && !values.productionUnitId) {
      setError("Choose the production unit for this account.");
      return;
    }
    if (!existingUser && values.password.length < 10) {
      setError("Set a demo password with at least 10 characters.");
      return;
    }
    const body = {
      name: values.name,
      email: values.email,
      role: values.role,
      buyerOrganizationId: values.role === "BUYER" ? values.buyerOrganizationId : null,
      productionUnitId: values.role === "SUPERVISOR" ? values.productionUnitId : null,
      isActive: values.isActive,
    };
    if (values.password) body.password = values.password;
    try {
      await onSave(body);
      setValues(initialForm);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "The user could not be saved.",
      );
    }
  }

  return (
    <form className="admin-user-form" onSubmit={submit}>
      <div className="admin-user-form__heading">
        <div>
          <p className="buyer-eyebrow">{existingUser ? "Edit account" : "New account"}</p>
          <h2>{existingUser ? existingUser.name : "Create user"}</h2>
        </div>
        <button aria-label="Close user form" className="admin-user-form__close" onClick={onCancel} type="button">×</button>
      </div>
      {error && <p className="form-alert form-alert--error" role="alert">{error}</p>}
      <div className="admin-user-form__grid">
        <label><span>Full name</span><input maxLength={120} onChange={(event) => change("name", event.target.value)} required value={values.name} /></label>
        <label><span>Email address</span><input autoComplete="off" maxLength={254} onChange={(event) => change("email", event.target.value)} required type="email" value={values.email} /></label>
        <label>
          <span>Role</span>
          <select onChange={(event) => change("role", event.target.value)} value={values.role}>
            <option value="ADMIN">Admin</option>
            <option value="MERCHANDISER">Merchandiser</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="BUYER">Buyer</option>
          </select>
        </label>
        {values.role === "BUYER" && (
          <label><span>Buyer organization</span><select onChange={(event) => change("buyerOrganizationId", event.target.value)} required value={values.buyerOrganizationId}><option value="">Select organization</option>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        )}
        {values.role === "SUPERVISOR" && (
          <label><span>Production unit</span><select onChange={(event) => change("productionUnitId", event.target.value)} required value={values.productionUnitId}><option value="">Select unit</option>{productionUnits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        )}
        <label><span>{existingUser ? "Reset password (optional)" : "Temporary demo password"}</span><input autoComplete="new-password" maxLength={72} minLength={existingUser ? undefined : 10} onChange={(event) => change("password", event.target.value)} required={!existingUser} type="password" value={values.password} /></label>
        {existingUser && <label className="admin-user-form__active"><input checked={values.isActive} onChange={(event) => change("isActive", event.target.checked)} type="checkbox" /><span>Account enabled</span></label>}
      </div>
      <p className="admin-user-form__hint">Passwords are hashed by the API and are never shown after saving. Demo users reset when the backend restarts.</p>
      <div className="admin-user-form__actions">
        <button className="button button--secondary" onClick={onCancel} type="button">Cancel</button>
        <button className="button button--primary" disabled={saving} type="submit">{saving ? "Saving…" : existingUser ? "Save changes" : "Create user"}</button>
      </div>
    </form>
  );
}
