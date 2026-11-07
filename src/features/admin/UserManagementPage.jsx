import { useCallback, useEffect, useState } from "react";
import { Plus, UsersRound } from "lucide-react";
import PageHeader from "../../components/PageHeader.jsx";
import { apiRequest } from "../auth/authApi.js";
import UserForm from "./UserForm.jsx";

const roleLabels = {
  ADMIN: "Admin",
  MERCHANDISER: "Merchandiser",
  SUPERVISOR: "Supervisor",
  BUYER: "Buyer",
};

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [productionUnits, setProductionUnits] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest("/api/users");
      setUsers(result.users);
      setOrganizations(result.organizations);
      setProductionUnits(result.productionUnits);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "User accounts could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function saveUser(values) {
    setSaving(true);
    try {
      if (editingUser) {
        await apiRequest(`/api/users/${encodeURIComponent(editingUser.id)}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
      } else {
        await apiRequest("/api/users", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
      setShowForm(false);
      setEditingUser(null);
      await loadUsers();
    } finally {
      setSaving(false);
    }
  }

  function closeForm() {
    setShowForm(false);
    setEditingUser(null);
  }

  return (
    <div className="admin-users-page">
      <header className="admin-users-page__header">
        <PageHeader
          description="Manage temporary demo accounts, roles, and organization or unit associations."
          title="User Management"
        />
        <button className="button button--primary" onClick={() => { setEditingUser(null); setShowForm(true); }} type="button">
          <Plus aria-hidden="true" size={17} /> Add user
        </button>
      </header>
      <p className="issue-demo-notice">
        Accounts and role assignments are stored in the StitchFlow database.
        Password hashes are never shown.
      </p>
      {error && <p className="form-alert form-alert--error" role="alert">{error}</p>}
      {showForm && (
        <UserForm
          existingUser={editingUser}
          onCancel={closeForm}
          onSave={saveUser}
          organizations={organizations}
          productionUnits={productionUnits}
          saving={saving}
        />
      )}
      <section aria-label="Demo users" className="admin-users-card">
        <div className="admin-users-card__heading">
          <div><UsersRound aria-hidden="true" size={18} /><h2>Accounts</h2></div>
          <span>{users.length} users</span>
        </div>
        {loading ? (
          <p aria-live="polite" className="buyer-load-state">Loading users…</p>
        ) : users.length ? (
          <div className="admin-users-table-wrap">
            <table className="admin-users-table">
              <thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Organization / Unit</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td data-label="User"><strong>{user.name}</strong><small>{user.email}</small></td>
                    <td data-label="Role"><span className={`admin-role-badge admin-role-badge--${user.role.toLowerCase()}`}>{roleLabels[user.role]}</span></td>
                    <td data-label="Organization / Unit">{user.buyerOrganizationName || user.productionUnitName || "All organizations"}</td>
                    <td data-label="Status"><span className={`admin-user-status${user.isActive ? " admin-user-status--active" : ""}`}>{user.isActive ? "Enabled" : "Disabled"}</span></td>
                    <td data-label="Actions"><button className="admin-user-edit" onClick={() => { setEditingUser(user); setShowForm(true); }} type="button">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="buyer-empty-state"><UsersRound aria-hidden="true" size={22} /><h3>No user accounts</h3><p>Create a demo user to get started.</p></div>
        )}
      </section>
    </div>
  );
}
