import { Button } from "@mantine/core";
import { IconMapSearch } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/feedback/EmptyState";

export const NotFoundPage = () => {
  const { t } = useTranslation();
  return (
    <EmptyState icon={<IconMapSearch size={28} stroke={1.6} />} title={t("notFound.title")} description={t("notFound.description")}>
      <Button component={Link} to="/pos" variant="default">
        {t("notFound.back")}
      </Button>
    </EmptyState>
  );
};
