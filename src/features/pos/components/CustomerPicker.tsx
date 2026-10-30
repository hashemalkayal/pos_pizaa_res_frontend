import { useState } from "react";
import { ActionIcon, Button, Combobox, Group, Loader, Modal, Paper, Stack, Text, TextInput, Tooltip, useCombobox } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconPhone, IconSearch, IconUser, IconUserPlus, IconX } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { errorMessageKey, toApiError } from "@/api/errors";
import { createCustomer, getCustomer, type Customer } from "@/api/v2/customers";
import { CUSTOMER_SEARCH_MIN_LENGTH, useCustomerSearch } from "../hooks/queries";

const PHONE_PATTERN = /^[0-9+()\- ]{3,32}$/;

interface NewCustomerModalProps {
  opened: boolean;
  initialQuery: string;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
}

/** POST /api/customers. A phone that already exists selects that customer instead (409 CUSTOMER_ALREADY_EXISTS). */
const NewCustomerModal = ({ opened, initialQuery, onClose, onSelect }: NewCustomerModalProps) => {
  const { t } = useTranslation();
  const looksLikePhone = PHONE_PATTERN.test(initialQuery.trim());
  const form = useForm({
    mode: "controlled",
    initialValues: { name: looksLikePhone ? "" : initialQuery.trim(), phone: looksLikePhone ? initialQuery.trim() : "" },
    validate: {
      name: (value) => (value.trim() ? null : "pos.customer.nameRequired"),
      phone: (value) => (PHONE_PATTERN.test(value.trim()) ? null : "pos.customer.phoneInvalid"),
    },
  });
  const mutation = useMutation({
    mutationFn: async (values: { name: string; phone: string }) => {
      try {
        return { customer: await createCustomer({ name: values.name.trim(), phone: values.phone.trim() }), existed: false };
      } catch (error) {
        const apiError = toApiError(error);
        const existingId = (apiError.details as { existingCustomerId?: number } | null)?.existingCustomerId;
        if (apiError.code === "CUSTOMER_ALREADY_EXISTS" && existingId) return { customer: await getCustomer(existingId), existed: true };
        throw error;
      }
    },
    onSuccess: ({ customer, existed }) => {
      notifications.show({ color: existed ? "yellow" : "green", message: t(existed ? "pos.customer.exists" : "pos.customer.created", { name: customer.name }) });
      onSelect(customer);
      onClose();
    },
  });
  const error = mutation.error ? toApiError(mutation.error) : null;

  return (
    <Modal opened={opened} onClose={onClose} title={t("pos.customer.createTitle")} centered radius="lg">
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))} noValidate>
        <Stack>
          <TextInput label={t("pos.customer.name")} withAsterisk data-autofocus {...form.getInputProps("name")} error={form.errors.name ? t(String(form.errors.name)) : null} />
          <TextInput label={t("pos.customer.phone")} withAsterisk dir="ltr" inputMode="tel" {...form.getInputProps("phone")} error={form.errors.phone ? t(String(form.errors.phone)) : null} />
          {error ? (
            <Text c="red.7" size="sm" role="alert">
              {t(errorMessageKey(error))}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button size="action" variant="default" onClick={onClose}>
              {t("pos.customer.cancel")}
            </Button>
            <Button size="action" type="submit" loading={mutation.isPending}>
              {t("pos.customer.save")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

interface CustomerPickerProps {
  customer: Customer | null;
  onChange: (customer: Customer | null) => void;
}

/** Optional customer: search by name or phone, select, change, remove, or create a new one. */
export const CustomerPicker = ({ customer, onChange }: CustomerPickerProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const search = useCustomerSearch(query);
  const results = search.enabled ? search.data?.items ?? [] : [];

  const select = (selected: Customer) => {
    onChange(selected);
    setQuery("");
    combobox.closeDropdown();
  };

  if (customer) {
    return (
      <Paper withBorder radius="md" p="sm">
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <IconUser size={20} aria-hidden />
            <div style={{ minWidth: 0 }}>
              <Text fw={700} size="sm" truncate>
                {customer.name}
              </Text>
              <Text size="xs" c="dimmed" dir="ltr" ta="start">
                {customer.phone}
              </Text>
            </div>
          </Group>
          <Group gap={4} wrap="nowrap">
            <Button size="action-compact" variant="subtle" color="charcoal" onClick={() => onChange(null)}>
              {t("pos.customer.change")}
            </Button>
            <Tooltip label={t("pos.customer.remove")}>
              <ActionIcon size="action" variant="subtle" color="gray" onClick={() => onChange(null)} aria-label={t("pos.customer.remove")}>
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Paper>
    );
  }

  const trimmed = query.trim();
  return (
    <>
      <Group gap="xs" wrap="nowrap" align="flex-end">
        <Combobox store={combobox} onOptionSubmit={(id) => {
          const selected = results.find((candidate) => String(candidate.id) === id);
          if (selected) select(selected);
        }}>
          <Combobox.Target>
            <TextInput
              style={{ flex: 1 }}
              label={t("pos.customer.label")}
              description={t("pos.customer.optional")}
              placeholder={t("pos.customer.searchPlaceholder")}
              aria-label={t("pos.customer.searchLabel")}
              value={query}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                combobox.openDropdown();
                combobox.updateSelectedOptionIndex();
              }}
              onFocus={() => combobox.openDropdown()}
              onBlur={() => combobox.closeDropdown()}
              leftSection={<IconSearch size={16} aria-hidden />}
              rightSection={search.pending && trimmed.length >= CUSTOMER_SEARCH_MIN_LENGTH ? <Loader size={14} /> : null}
            />
          </Combobox.Target>
          <Combobox.Dropdown hidden={!trimmed}>
            <Combobox.Options>
              {trimmed.length < CUSTOMER_SEARCH_MIN_LENGTH ? (
                <Combobox.Empty>{t("pos.customer.minChars")}</Combobox.Empty>
              ) : results.length ? (
                results.map((candidate) => (
                  <Combobox.Option key={candidate.id} value={String(candidate.id)}>
                    <Group justify="space-between" wrap="nowrap" gap="sm">
                      <Text size="sm" fw={600} truncate>
                        {candidate.name}
                      </Text>
                      <Group gap={4} wrap="nowrap">
                        <IconPhone size={14} aria-hidden />
                        <Text size="sm" c="dimmed" dir="ltr">
                          {candidate.phone}
                        </Text>
                      </Group>
                    </Group>
                  </Combobox.Option>
                ))
              ) : (
                <Combobox.Empty>{search.pending ? t("pos.customer.searching") : t("pos.customer.noResults")}</Combobox.Empty>
              )}
            </Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>
        <Tooltip label={t("pos.customer.new")}>
          <ActionIcon size="action" variant="default" onClick={() => setCreating(true)} aria-label={t("pos.customer.new")}>
            <IconUserPlus size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {creating ? <NewCustomerModal opened initialQuery={query} onClose={() => setCreating(false)} onSelect={select} /> : null}
    </>
  );
};
