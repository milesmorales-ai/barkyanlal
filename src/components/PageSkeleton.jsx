import './PageSkeleton.css';

export default function PageSkeleton({ colors, showHeading = true }) {
  return (
    <div
      className="page-skeleton"
      aria-busy="true"
      aria-label="Loading page"
      style={{
        '--skeleton-base': colors.cardBg,
        '--skeleton-highlight': colors.inputBg,
        '--skeleton-border': colors.cardBorder,
      }}
    >
      {showHeading && (
        <div className="page-skeleton-heading">
          <div className="page-skeleton-line page-skeleton-title" />
          <div className="page-skeleton-line page-skeleton-subtitle" />
        </div>
      )}

      <div className="page-skeleton-recipe-grid">
        {[1, 2, 3].map((card) => (
          <div className="page-skeleton-recipe-card" key={card}>
            <div className="page-skeleton-line page-skeleton-recipe-title" />
            <div className="page-skeleton-line page-skeleton-recipe-meta" />
            <div className="page-skeleton-line page-skeleton-recipe-badge" />
          </div>
        ))}
      </div>
    </div>
  );
}
