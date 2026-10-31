import { useEffect, useRef, useState, type FC } from "react";
import { ActionIcon, Button, VisuallyHidden } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import {
  IconArrowUpRight,
  IconBrandFacebook,
  IconBrandInstagram,
  IconDiscount,
  IconMapPin,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconSettings,
  IconToolsKitchen2,
} from "@tabler/icons-react";
import { Trans, useTranslation } from "react-i18next";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import Vid from "../assets/852299-hd_1920_1080_30fps.mp4";
import classes from "./Landing.module.css";

const LINKS = {
  menu: "https://www.dropbox.com/scl/fi/36015era163y95tpqr3og/Menu-Final-Engineer-s-Pizza.pdf?rlkey=du0j3wx5tmw054dbknmv1gxsk&st=3sdbv7de&dl=0",
  offers: "https://www.instagram.com/engineerspizza/",
  locations: "https://maps.app.goo.gl/mbnkxKF17gnpqYc96",
  facebook: "https://www.facebook.com/people/EngineersPizza/61576146285998/",
  instagram: "https://www.instagram.com/engineerspizza/",
} as const;

const external = { component: "a", target: "_blank", rel: "noopener noreferrer" } as const;

/**
 * Public page, isolated from the POS: no session, no API. Same identity as the sign-in page: the official logo on the
 * charcoal brand panel, the food video beside it, the yellow accent bar; English / Arabic like the rest of the app.
 */
const Landing: FC = () => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();
  // Follows the video itself: autoplay can be refused by the browser (e.g. low-power mode).
  const [playing, setPlaying] = useState(false);

  // Visitors who ask for reduced motion get a still background (a pause before autoplay starts cancels it).
  useEffect(() => {
    if (reduceMotion) videoRef.current?.pause();
  }, [reduceMotion]);

  const toggleVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  };

  const newTab = <VisuallyHidden>{t("landing.newTab")}</VisuallyHidden>;

  return (
    <div className={classes.page}>
      <div className={classes.toolbar}>
        <LanguageSwitch inverted />
      </div>

      <main className={classes.panel}>
        <IconSettings className={classes.gear} stroke={0.6} aria-hidden />

        <div className={classes.content}>
          <h1 className={classes.heading}>
            <BrandLogo className={classes.logo} />
          </h1>
          <p className={classes.tagline}>
            <Trans i18nKey="landing.tagline" components={{ accent: <span className={classes.accent} /> }} />
          </p>

          <div className={classes.actions}>
            <Button
              {...external}
              href={LINKS.menu}
              size="lg"
              fullWidth
              justify="space-between"
              leftSection={<IconToolsKitchen2 size={22} aria-hidden />}
              rightSection={<IconArrowUpRight size={18} className={classes.mirror} aria-hidden />}
              className={classes.primary}
            >
              {t("landing.menu")}
              {newTab}
            </Button>
            <div className={classes.secondaryRow}>
              <Button
                {...external}
                href={LINKS.offers}
                size="md"
                variant="outline"
                fullWidth
                leftSection={<IconDiscount size={19} aria-hidden />}
                className={classes.secondary}
              >
                {t("landing.offers")}
                {newTab}
              </Button>
              <Button
                {...external}
                href={LINKS.locations}
                size="md"
                variant="outline"
                fullWidth
                leftSection={<IconMapPin size={19} aria-hidden />}
                className={classes.secondary}
              >
                {t("landing.locations")}
                {newTab}
              </Button>
            </div>
          </div>

          <div className={classes.social}>
            <p className={classes.socialLabel}>{t("landing.connect")}</p>
            <div className={classes.socialLinks}>
              <ActionIcon {...external} href={LINKS.facebook} size={44} radius="xl" variant="outline" className={classes.socialLink} aria-label="Facebook">
                <IconBrandFacebook size={20} aria-hidden />
              </ActionIcon>
              <ActionIcon {...external} href={LINKS.instagram} size={44} radius="xl" variant="outline" className={classes.socialLink} aria-label="Instagram">
                <IconBrandInstagram size={20} aria-hidden />
              </ActionIcon>
            </div>
          </div>
        </div>

        <footer className={classes.footer}>{t("landing.copyright", { year: new Date().getFullYear() })}</footer>
      </main>

      <div className={classes.media}>
        <video
          ref={videoRef}
          className={classes.video}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        >
          <source src={Vid} type="video/mp4" />
        </video>
        <ActionIcon
          size={40}
          radius="xl"
          variant="transparent"
          className={classes.videoToggle}
          aria-label={t(playing ? "landing.pauseVideo" : "landing.playVideo")}
          onClick={toggleVideo}
        >
          {playing ? <IconPlayerPauseFilled size={16} aria-hidden /> : <IconPlayerPlayFilled size={16} aria-hidden />}
        </ActionIcon>
      </div>
    </div>
  );
};

export default Landing;
