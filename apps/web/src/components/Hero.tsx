import VideoBackground from './VideoBackground';
import NavBar from './NavBar';
import HeroContent from './HeroContent';
import SocialFooter from './SocialFooter';

export default function Hero() {
  return (
    <div className="min-h-screen bg-black overflow-hidden relative">
      <VideoBackground />
      <NavBar />
      <div className="flex flex-col min-h-screen">
        <div className="flex-1">
          <HeroContent />
        </div>
        <SocialFooter />
      </div>
    </div>
  );
}
