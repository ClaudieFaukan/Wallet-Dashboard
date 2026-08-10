import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ToastContainer } from '../ui/Toast';
import { MilestoneCelebrationOverlay } from '../ui/MilestoneCelebration';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-bg-base">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <ToastContainer />
      <MilestoneCelebrationOverlay />
    </div>
  );
}
