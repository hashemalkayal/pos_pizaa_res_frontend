import type { FC } from "react";
import { IconBrandFacebook, IconBrandInstagram } from "@tabler/icons-react";
import Vid from "../assets/852299-hd_1920_1080_30fps.mp4";
import classes from "./Landing.module.css";

// Public page kept from the previous app (redesign deferred). Isolated from the POS: no session, no API.
const Landing: FC = () => {
  const nav = (path: string) => {
    window.open(path, "_blank");
  };

  return (
    <div className={classes.page}>
      <video autoPlay loop muted playsInline className={classes.video}>
        <source src={Vid} type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      <div className={classes.overlay} />

      <div className={classes.content}>
        <div>
          <h1 className={classes.title}>Engineers Pizza</h1>
          <p className={classes.tagline}>
            Re<span className={classes.accent}>...</span> designing taste
          </p>
        </div>

        <div className={classes.buttons}>
          <button
            type="button"
            className={classes.button}
            onClick={() =>
              nav(
                "https://www.dropbox.com/scl/fi/36015era163y95tpqr3og/Menu-Final-Engineer-s-Pizza.pdf?rlkey=du0j3wx5tmw054dbknmv1gxsk&st=3sdbv7de&dl=0"
              )
            }
          >
            Menu
          </button>
          <button type="button" className={classes.button} onClick={() => nav("https://www.instagram.com/engineerspizza/")}>
            Offers
          </button>
          <button type="button" className={classes.button} onClick={() => nav("https://maps.app.goo.gl/mbnkxKF17gnpqYc96")}>
            Locations
          </button>
        </div>

        <div className={classes.social}>
          <p className={classes.socialLabel}>Connect with us!</p>
          <div className={classes.socialLinks}>
            <a
              href="https://www.facebook.com/people/EngineersPizza/61576146285998/"
              target="_blank"
              rel="noopener noreferrer"
              className={`${classes.socialLink} ${classes.facebook}`}
              aria-label="Facebook"
            >
              <IconBrandFacebook size={20} />
            </a>
            <a
              href="https://www.instagram.com/engineerspizza/"
              target="_blank"
              rel="noopener noreferrer"
              className={`${classes.socialLink} ${classes.instagram}`}
              aria-label="Instagram"
            >
              <IconBrandInstagram size={20} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
