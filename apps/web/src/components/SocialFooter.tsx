import { SOCIALS } from '../constants/socials';
import { SocialIconButton } from './SocialIconButton';

/**
 * Social footer — 13-line assembler (spec §五.4).
 * Replaces v0.13.A's 23-line inline Globe implementation with mapper.
 */
export default function SocialFooter() {
  return (
    <div className="relative z-10 flex justify-center gap-4 pb-12">
      {SOCIALS.map((platform) => (
        <SocialIconButton key={platform.id} platform={platform} />
      ))}
    </div>
  );
}
