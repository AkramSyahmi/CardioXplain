// UC-800 Manage User Accounts (Figure 3.35).
import { useEffect, useState } from "react";
import { apiRequest } from "../api.js";
import FieldError from "../components/FieldError.jsx";
import "./AdminPages.css";
import { formatDate } from "../format.js";

const ROLE_NAMES = { admin: "Administrator", general_user: "General User" };
const EMPTY = { full_name: "", email: "", role: "general_user", password: "" };

function UserRow({ user, onUpdated }) {
  const [role, setRole] = useState(user.role);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function update(changes, done) {
    setBusy(true);
    setMessage("");
    try {
      const data = await apiRequest(`/admin/users/${user.user_id}`, { method: "PATCH", body: changes });
      onUpdated(data.user);
      setMessage(done);
      return true;
    } catch (err) {
      setMessage(err.fields?.password || err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (await update({ password }, "Password reset.")) setPassword("");
  }

  const nextStatus = user.status === "active" ? "inactive" : "active";
  return (
    <tr>
      <td>{user.full_name}</td>
      <td>{user.email}</td>
      <td>
        <select aria-label={`Role for ${user.full_name}`} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="general_user">{ROLE_NAMES.general_user}</option>
          <option value="admin">{ROLE_NAMES.admin}</option>
        </select>{" "}
        <button type="button" disabled={busy || role === user.role} onClick={() => update({ role }, "Saved.")}>
          Save role
        </button>
      </td>
      <td>{user.status}</td>
      <td>{formatDate(user.created_at)}</td>
      <td className="row-actions">
        <button type="button" className={user.status === "active" ? "danger" : ""} disabled={busy}
          onClick={() => update({ status: nextStatus }, nextStatus === "active" ? "Activated." : "Deactivated.")}>
          {user.status === "active" ? "Deactivate" : "Activate"}
        </button>
        {/* Password reset stays folded away so each row is one line until it is needed. */}
        <details className="pw-reset">
          <summary>Set new password</summary>
          <div className="pw-pop">
            <input type="password" aria-label={`New password for ${user.full_name}`} placeholder="New password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" disabled={busy || !password} onClick={resetPassword}>Reset password</button>
          </div>
        </details>
        {message && <p role="status" className="row-message">{message}</p>}
      </td>
    </tr>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const [created, setCreated] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiRequest("/admin/users").then((data) => setUsers(data.users)).catch((err) => setLoadError(err.message));
  }, []);

  function replaceUser(updated) {
    setUsers((list) => list.map((u) => (u.user_id === updated.user_id ? updated : u)));
  }

  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function createUser(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    setCreated("");
    try {
      const data = await apiRequest("/admin/users", { method: "POST", body: form });
      setUsers((list) => [...list, data.user]);
      setForm(EMPTY);
      setCreated("User created.");
    } catch (err) {
      setError(err.message);
      setFields(err.fields || {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>User management</h1>
      {loadError && <p role="alert">{loadError}</p>}
      {!users && !loadError && <p>Loading...</p>}
      {users && (
        <div className="card table-scroll users-card">
        <table aria-label="Users">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map((u) => <UserRow key={u.user_id} user={u} onUpdated={replaceUser} />)}
          </tbody>
        </table>
        </div>
      )}

      <section className="card admin-create" aria-labelledby="create-heading">
      <h2 id="create-heading">Create a user</h2>
      <p className="help">The new user signs in with the temporary password. Share it with them privately.</p>
      {created && <p role="status">{created}</p>}
      {error && <p role="alert">{error}</p>}
      <form onSubmit={createUser} noValidate>
        <div className="field-grid">
        <div className="field">
          <label htmlFor="new_full_name">Full name</label>
          <input id="new_full_name" name="full_name" value={form.full_name} onChange={change} />
          <FieldError fields={fields} name="full_name" />
        </div>
        <div className="field">
          <label htmlFor="new_email">Email</label>
          <input id="new_email" name="email" type="email" value={form.email} onChange={change} />
          <FieldError fields={fields} name="email" />
        </div>
        <div className="field">
          <label htmlFor="new_role">Role</label>
          <select id="new_role" name="role" value={form.role} onChange={change}>
            <option value="general_user">{ROLE_NAMES.general_user}</option>
            <option value="admin">{ROLE_NAMES.admin}</option>
          </select>
          <FieldError fields={fields} name="role" />
        </div>
        <div className="field">
          <label htmlFor="new_password">Temporary password</label>
          <input id="new_password" name="password" type="password" value={form.password} onChange={change} />
          <FieldError fields={fields} name="password" />
        </div>
        </div>
        <button type="submit" disabled={busy}>{busy ? "Creating..." : "Create user"}</button>
      </form>
      </section>
    </>
  );
}
