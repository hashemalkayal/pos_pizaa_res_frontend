import { useState } from "react";
import { Alert, Button, Group, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconInfoCircle, IconKey, IconMail } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { login } from "@/api/v2/auth";
import { toApiError, type ApiError } from "@/api/errors";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { MockModeBadge } from "@/components/layout/MockModeBadge";
import type { SignInLocationState } from "./RouteGuards";
import { useSession } from "./sessionContext";
import classes from "./LoginPage.module.css";

// Same leniency as before; the backend's validator has the final word.
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

/** User-facing message for a failed sign-in (backend: login.controller.ts). */
const signInErrorMessage = (error: ApiError, t: (key: string, options?: Record<string, unknown>) => string) => {
  switch (error.kind) {
    case "unauthorized":
      return t("auth.errors.invalidCredentials");
    case "rateLimited":
      return t("auth.errors.tooManyAttempts", { count: Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60)) });
    case "network":
    case "timeout":
    case "server":
      return t(`errors.${error.kind}`);
    default:
      return t("errors.unknown");
  }
};

export const LoginPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { signIn } = useSession();
  const state = (location.state ?? {}) as SignInLocationState;
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    mode: "controlled",
    initialValues: { email: "", password: "" },
    // Values are i18n keys, translated when shown so they follow a language change.
    validate: {
      email: (value) => (!value.trim() ? "auth.errors.emailRequired" : EMAIL_PATTERN.test(value.trim()) ? null : "auth.errors.emailInvalid"),
      password: (value) => (value ? null : "auth.errors.passwordRequired"),
    },
  });

  const mutation = useMutation({
    mutationFn: login,
    // On success the route guard sends the user on (to the page they asked for, or the POS).
    onSuccess: (result) => {
      if (!signIn(result.accessToken)) setFormError(t("auth.errors.unexpectedResponse"));
    },
    onError: (error) => {
      const apiError = toApiError(error);
      if (apiError.kind === "validation" && apiError.fieldErrors.length) {
        for (const { field } of apiError.fieldErrors) {
          if (field === "email") form.setFieldError("email", "auth.errors.emailInvalid");
          if (field === "password") form.setFieldError("password", "auth.errors.passwordRequired");
        }
        return;
      }
      setFormError(signInErrorMessage(apiError, t));
    },
  });

  const submit = form.onSubmit(({ email, password }) => {
    if (mutation.isPending) return;
    setFormError(null);
    mutation.mutate({ email: email.trim(), password });
  });

  const fieldError = (name: "email" | "password") => {
    const key = form.errors[name];
    return typeof key === "string" ? t(key) : undefined;
  };

  return (
    <div className={classes.page}>
      <section className={classes.brandPanel} aria-label={t("app.name")}>
        <BrandLogo className={classes.logo} />
        <Text className={classes.tagline}>{t("app.product")}</Text>
      </section>

      <main className={classes.formPanel}>
        <Group className={classes.toolbar} gap="sm">
          <MockModeBadge />
          <LanguageSwitch />
        </Group>

        <Paper className={classes.card} p={{ base: "lg", sm: "xl" }} shadow="sm" withBorder>
          <form onSubmit={submit} noValidate>
            <Stack gap="lg">
              <Stack gap={4}>
                <Title order={1} size="h2">
                  {t("auth.title")}
                </Title>
                <Text c="dimmed">{t("auth.subtitle")}</Text>
              </Stack>

              {state.reason && !formError ? (
                <Alert variant="light" color="charcoal" icon={<IconInfoCircle size={18} />} role="status">
                  {t(`auth.session.${state.reason}`)}
                </Alert>
              ) : null}

              {formError ? (
                <Alert variant="light" color="red" icon={<IconAlertCircle size={18} />} role="alert">
                  {formError}
                </Alert>
              ) : null}

              <TextInput
                label={t("auth.email")}
                type="email"
                autoComplete="username"
                inputMode="email"
                dir="ltr"
                size="md"
                leftSection={<IconMail size={18} aria-hidden />}
                required
                {...form.getInputProps("email")}
                error={fieldError("email")}
              />
              <PasswordInput
                label={t("auth.password")}
                autoComplete="current-password"
                size="md"
                leftSection={<IconKey size={18} aria-hidden />}
                required
                {...form.getInputProps("password")}
                error={fieldError("password")}
              />

              <Button type="submit" size="md" fullWidth loading={mutation.isPending}>
                {t("auth.submit")}
              </Button>
            </Stack>
          </form>
        </Paper>
      </main>
    </div>
  );
};
