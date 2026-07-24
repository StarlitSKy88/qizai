// Home composition — VideoBackground + HeroContent only.
// NavBar + SocialFooter are rendered by Layout (parent <Outlet /> wrapper),
// so importing them via Hero would cause double-render.
import VideoBackground from '../components/VideoBackground';
import HeroContent from '../components/HeroContent';

export default function Home() {
  return (
    <>
      <VideoBackground />
      <HeroContent />
    </>
  );
}
