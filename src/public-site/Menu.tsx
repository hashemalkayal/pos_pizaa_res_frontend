import { type FC } from "react";

const Menu: FC = () => {
  const pdfUrl =
    "https://www.dropbox.com/scl/fi/36015era163y95tpqr3og/Menu-Final-Engineer-s-Pizza.pdf?rlkey=du0j3wx5tmw054dbknmv1gxsk&st=3sdbv7de&dl=0";
  const downloadUrl = pdfUrl; // can use same, browser will offer download
  return (
    <div>
      <iframe
        src={pdfUrl}
        width="100%"
        height="800"
        style={{ border: "none" }}
        allow="autoplay"
      ></iframe>
      <div style={{ marginTop: "1rem", textAlign: "center" }}>
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            textDecoration: "none",
            backgroundColor: "#4285f4",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: "4px",
          }}
        >
          Download Menu PDF
        </a>
      </div>
    </div>
  );
};

export default Menu;
