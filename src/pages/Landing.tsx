import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { FaFacebookF, FaInstagram } from "react-icons/fa";
import Vid from "../assets/852299-hd_1920_1080_30fps.mp4";

const Landing: FC = () => {
  const nav = (path: string) => {
    window.open(path, "_blank");
    // window.location.href = path;
  };

  return (
    <div className="relative h-screen w-full overflow-hidden text-center text-white">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src={Vid} type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 z-10" />

      {/* Content */}
      <div className="relative z-20 flex flex-col items-center justify-center h-full px-4 space-y-10 animate-fadeIn">
        {/* Header */}
        <div>
          {/* <img src={Logo} className="object-contain" /> */}

          <h1 className="text-4xl md:text-5xl font-extrabold text-white drop-shadow-md">
            Engineers Pizza
          </h1>
          <p className="text-md md:text-lg mt-2 italic text-gray-200">
            Re<span className="text-primary">...</span> designing taste
          </p>
        </div>

        {/* Buttons */}
        <div className="space-y-4 w-full max-w-xs">
          <Button
            onClick={() =>
              nav(
                "https://www.dropbox.com/scl/fi/36015era163y95tpqr3og/Menu-Final-Engineer-s-Pizza.pdf?rlkey=du0j3wx5tmw054dbknmv1gxsk&st=3sdbv7de&dl=0"
              )
            }
            className="w-full bg-primary text-dark hover:bg-primary/90"
          >
            Menu
          </Button>
          <Button
            onClick={() => nav("https://www.instagram.com/engineerspizza/")}
            className="w-full bg-primary text-dark hover:bg-primary/90"
          >
            Offers
          </Button>
          <Button
            onClick={() => nav("https://maps.app.goo.gl/mbnkxKF17gnpqYc96")}
            className="w-full bg-primary text-dark hover:bg-primary/90"
          >
            Locations
          </Button>
        </div>

        {/* Social Media */}
        <div className="mt-8 space-y-2">
          <p className="text-sm text-white">Connect with us!</p>
          <div className="flex gap-4 justify-center">
            <a
              href="https://www.facebook.com/people/EngineersPizza/61576146285998/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-blue-600 rounded-full p-3 shadow-md hover:scale-110 transition"
            >
              <FaFacebookF className="w-5 h-5" />
            </a>
            <a
              href="https://www.instagram.com/engineerspizza/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-pink-500 rounded-full p-3 shadow-md hover:scale-110 transition"
            >
              <FaInstagram className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
