import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ApprovalsPage from './pages/ApprovalsPage';
import DashboardPage from './pages/DashboardPage';
import FeaturesPage from './pages/FeaturesPage';

/**
 * Product chrome lives in Astro (`apps/web`). This app only supplies React Bits
 * bodies. `/embed/*` is chrome-less for iframe mounting; bare routes keep a
 * tiny lab banner so :5173 is not mistaken for the FleetScope product.
 */
export default function App() {
  const { pathname } = useLocation();
  const embedded = pathname.startsWith('/embed');

  return (
    <div className={embedded ? 'min-h-full' : 'flex min-h-screen flex-col'}>
      {!embedded && (
        <header className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium">React Bits lab only — not the product shell</p>
          <p className="mt-1 text-amber-100/80">
            Open the FleetScope site for landing, Demo, Viewer, and nav:{' '}
            <a className="underline hover:text-white" href="http://127.0.0.1:4321/">
              http://127.0.0.1:4321/
            </a>
            . Embeds mount inside Astro at{' '}
            <a className="underline hover:text-white" href="http://127.0.0.1:4321/approvals">
              /approvals
            </a>{' '}
            and{' '}
            <a className="underline hover:text-white" href="http://127.0.0.1:4321/dashboard">
              /dashboard
            </a>
            .
          </p>
        </header>
      )}

      <main
        className={embedded ? 'min-h-full' : 'mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6'}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/embed/dashboard" replace />} />
          <Route path="/embed/dashboard" element={<DashboardPage embedded />} />
          <Route path="/embed/approvals" element={<ApprovalsPage embedded />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/features" element={<FeaturesPage />} />
        </Routes>
      </main>
    </div>
  );
}
