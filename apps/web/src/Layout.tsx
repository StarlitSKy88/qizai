import { Outlet } from 'react-router-dom';
import NavBar from './components/NavBar';
import SocialFooter from './components/SocialFooter';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 to-black">
      <NavBar />
      <main className="flex-1">
        <Outlet />
      </main>
      <SocialFooter />
    </div>
  );
}
