export default function AppLoader({
  fullscreen = false,
  label = "Loading your workspace",
}: {
  fullscreen?: boolean;
  label?: string;
}) {
  return (
    <div className={fullscreen ? "app-loader fullscreen" : "app-loader"} role="status" aria-live="polite">
      <div className="loader-emblem" aria-hidden="true">
        <span className="loader-orbit" />
        <span className="loader-logo">R</span>
      </div>
      <strong>{label}</strong>
      <p>Organising your records securely</p>
      <span className="loader-dots" aria-hidden="true"><i /><i /><i /></span>
    </div>
  );
}
