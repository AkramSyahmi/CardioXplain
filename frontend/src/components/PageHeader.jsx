// One header for every page (same height everywhere): the page's sidebar icon beside the title, one useful
// line under it, and a real status or the page's main action on the right. Always two lines on the left,
// so the title sits in the same place on every page.
import Icon from "./Icon.jsx";
import "./PageHeader.css";

export default function PageHeader({ icon, title, lead, children }) {
  return (
    <div className="page-header">
      <div className="page-heading">
        <span className="page-icon" aria-hidden="true"><Icon name={icon} size={22} /></span>
        <h1>{title}</h1>
        <p className="page-lead">{lead}</p>
      </div>
      {children && <div className="page-side">{children}</div>}
    </div>
  );
}
