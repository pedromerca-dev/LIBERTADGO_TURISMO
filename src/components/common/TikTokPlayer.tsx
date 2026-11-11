
import React from 'react';

interface TikTokPlayerProps {
  videoId: string;
  title?: string;
  maxWidth?: number;
}

export const TikTokPlayer: React.FC<TikTokPlayerProps> = ({
  videoId,
  title = 'Video de TikTok',
  maxWidth = 260,
}) => {
  if (!/^\d+$/.test(videoId)) return null;

  const embedUrl = `https://www.tiktok.com/player/v1/${videoId}?music_info=1&description=1`;

  return (
    <section className="pt-3 border-t border-[#E9EEF4] space-y-2">
      <div>
        <h4 className="text-sm font-bold text-[#17243A]">
          {title}
        </h4>
        <p className="text-[11px] text-[#64748B]">
          Descubre este lugar en video
        </p>
      </div>

      <div
        className="mx-auto w-full"
        style={{ maxWidth: `${maxWidth}px` }}
      >
        <div className="relative w-full aspect-[9/16] overflow-hidden rounded-2xl bg-[#17243A] border border-[#E2E8F0] shadow-sm">
          <iframe
            src={embedUrl}
            title={title}
            className="absolute inset-0 w-full h-full border-0"
            allow="encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>

      <p className="text-[10px] text-center text-[#94A3B8]">
        Reproducción mediante el reproductor oficial de TikTok
      </p>
    </section>
  );
};

export default TikTokPlayer;
