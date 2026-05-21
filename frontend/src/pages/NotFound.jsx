import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="not-found-page">
      <div className="not-found-code">404</div>
      <h1><span className="gradient-text">Page Not Found</span></h1>
      <p className="text-muted" style={{ marginBottom: "2rem", maxWidth: 440, textAlign: "center", lineHeight: 1.7 }}>
        The page you're looking for doesn't exist or has been moved. Check the URL or head back to explore projects.
      </p>
      <div className="flex" style={{ gap: "0.75rem" }}>
        <Link to="/">
          <button className="btn-shimmer">← Back to Projects</button>
        </Link>
        <Link to="/explore">
          <button className="btn-secondary">🔍 Explore</button>
        </Link>
      </div>
    </div>
  );
}
