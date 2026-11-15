// One header for every page (same height everywhere): the page's sidebar icon, title and a useful
// sentence on the left; a real status or the page's main action on the right.
import Icon from "./Icon.jsx";
import "./PageHeader.css";

export default function PageHeader({ icon, title, lead, crumb, children }) {
  return (
    <div className="page-header">
      <span className="page-icon" aria-hidden="true"><Icon name={icon} size={22} /></span>
      <div className="page-heading">
        {crumb && <p className="page-crumb">{crumb}</p>}
        <h1>{title}</h1>
        {lead && <p className="page-lead">{lead}</p>}
      </div>
      {children && <div className="page-side">{children}</div>}
    </div>
  );
}
