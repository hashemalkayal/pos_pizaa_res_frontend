import { act, render, screen } from "@testing-library/react";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/AppProviders";
import { createQueryClient } from "@/app/queryClient";
import i18n from "@/i18n";
import { ErrorState } from "./feedback/ErrorState";
import { CurrencyText } from "./money/CurrencyText";

const renderWithProviders = (ui: ReactNode) =>
  render(
    <AppProviders queryClient={createQueryClient()} env="test">
      {ui}
    </AppProviders>
  );

const httpError = (status: number, data: unknown) => {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("failed", "ERR_BAD_RESPONSE", config, {}, { status, data, headers: {}, config, statusText: "" } as AxiosResponse);
};

describe("CurrencyText", () => {
  it("shows JOD with exactly three decimals; the number stays left-to-right in Arabic", async () => {
    renderWithProviders(<CurrencyText value="1234.5" data-testid="amount" />);
    expect(screen.getByTestId("amount")).toHaveTextContent("1,234.500 JOD");
    await act(async () => {
      await i18n.changeLanguage("ar");
    });
    const amount = screen.getByTestId("amount");
    expect(amount).toHaveTextContent("1,234.500 د.أ");
    expect(amount.querySelector("bdi")).toHaveAttribute("dir", "ltr");
  });
});

describe("ErrorState", () => {
  it("server error: message, support reference and retry", async () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <ErrorState
        error={httpError(500, { message: "internal server error", statusCode: 500, code: "INTERNAL_ERROR", error: { code: "INTERNAL_ERROR", details: { requestId: "req-42" } } })}
        onRetry={onRetry}
      />
    );
    expect(screen.getByText("The server could not complete the request. Please try again.")).toBeInTheDocument();
    expect(screen.getByText("Reference: req-42")).toBeInTheDocument();
    screen.getByRole("button", { name: "Try again" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
