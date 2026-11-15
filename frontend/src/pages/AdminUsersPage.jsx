// UC-800 Manage User Accounts (Figure 3.35).
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../api.js";
import FieldError from "../components/FieldError.jsx";
import Icon from "../components/Icon.jsx";
import PageHeader from "../components/PageHeader.jsx";
import "./AdminPages.css";
import { formatDate } from "../format.js";
import Skeleton from "../components/Skeleton.jsx";

const ROLE_NAMES = { admin: "Administrator", general_user: "General User" };
const EMPTY = { full_name: "", email: "", role: "general_user", password: "" };
const GROUP_NAMES = { admin: "Administrators", general_user: "General users" };

/** One group per role: the known roles always (empty ones say so), plus any other role found in the data. */
function groupByRole(users) {
  const roles = [...new Set([...Object.keys(GROUP_NAMES), ...users.map((u) => u.role)])];
  return roles.map((role) => ({ role, name: GROUP_NAMES[role] ?? role, users: users.filter((u) => u.role === role) }));
}

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
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const openButton = useRef(null);
  const dialog = useRef(null);

  useEffect(() => {
    apiRequest("/admin/users").then((data) => setUsers(data.users)).catch((err) => setLoadError(err.message));
  }, []);

  function replaceUser(updated) {
    // A new role moves the row to another group, so say where it went.
    const old = users.find((u) => u.user_id === updated.user_id);
    if (old && old.role !== updated.role) {
      setNotice(`${updated.full_name} is now in ${GROUP_NAMES[updated.role] ?? updated.role}.`);
    }
    setUsers((list) => list.map((u) => (u.user_id === updated.user_id ? updated : u)));
  }

  function openCreate() {
    setForm(EMPTY);
    setError("");
    setFields({});
    setCreating(true);
  }

  function closeCreate() {
    setCreating(false);
    openButton.current?.focus(); // back to the button that opened the dialog
  }

  useEffect(() => {
    if (!creating) return undefined;
    dialog.current.querySelector("input")?.focus();
    function onKey(event) {
      if (event.key === "Escape") closeCreate();
      if (event.key !== "Tab") return;
      // Keep keyboard focus inside the dialog while it is open.
      const items = [...dialog.current.querySelectorAll("input, select, button")].filter((el) => !el.disabled);
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [creating]);

  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function createUser(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    try {
      const data = await apiRequest("/admin/users", { method: "POST", body: form });
      setUsers((list) => [...list, data.user]);
      closeCreate();
      setNotice(`${data.user.full_name} was created and added to ${GROUP_NAMES[data.user.role] ?? data.user.role}.`);
    } catch (err) {
      setError(err.message);
      setFields(err.fields || {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader icon="user" title="User management" lead="Create accounts, deactivate users and reset passwords.">
        {users && <span className="chip">{users.length} account{users.length === 1 ? "" : "s"}</span>}
        <button type="button" className="btn btn-primary" ref={openButton} onClick={openCreate}>
          Create user<span className="go go-light"><Icon name="plus" /></span>
        </button>
      </PageHeader>
      {loadError && <p role="alert">{loadError}</p>}
      {!users && !loadError && <Skeleton lines={6} />}
      {notice && <p role="status" className="users-notice">{notice}</p>}
      {users && groupByRole(users).map((group) => (
        <section key={group.role} className="card users-group" aria-labelledby={`group-${group.role}`}>
          <h2 id={`group-${group.role}`} className="users-group-head">
            {group.name} <span className="chip">{group.users.length}</span>
          </h2>
          {group.users.length === 0 ? <p className="help">No {group.name.toLowerCase()} yet.</p> : (
            <div className="table-scroll users-card">
              <table aria-label={group.name}>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {group.users.map((u) => <UserRow key={u.user_id} user={u} onUpdated={replaceUser} />)}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      {creating && (
      // Dark backdrop: clicking it (outside the card) closes the dialog, like Cancel.
      <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCreate(); }}>
      <section className="card modal" role="dialog" aria-modal="true" aria-labelledby="create-heading" ref={dialog}>
      <h2 id="create-heading">Create a user</h2>
      <p className="help">The new user signs in with the temporary password. Share it with them privately.</p>
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
        <div className="modal-actions">
          <button type="button" className="btn btn-light" onClick={closeCreate}>Cancel</button>
          <button type="submit" disabled={busy}>{busy ? "Saving..." : "Save user"}</button>
        </div>
      </form>
      </section>
      </div>
      )}
    </>
  );
}
