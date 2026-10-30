import { useTranslation } from "react-i18next";
import logo from "@/assets/logo.png";
import classes from "./BrandLogo.module.css";

/**
 * The official Engineers Pizza logo (src/assets/logo.png, unmodified). Its background is the brand charcoal,
 * so it is placed on charcoal surfaces only.
 */
export const BrandLogo = ({ className }: { className?: string }) => {
  const { t } = useTranslation();
  return <img src={logo} alt={t("app.name")} className={className ? `${classes.logo} ${className}` : classes.logo} />;
};
