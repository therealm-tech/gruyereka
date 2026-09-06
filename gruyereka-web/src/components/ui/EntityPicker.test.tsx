import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Option } from "@/app/actions/pick";
import { EntityPicker } from "@/components/ui/EntityPicker";

const COMTE: Option = { id: "cheese-1", label: "Comté", hint: "Vache · Pressée cuite" };
const CANTAL: Option = { id: "cheese-2", label: "Cantal", hint: "Vache · Pressée non cuite" };

function picker(search: (query: string) => Promise<Option[]>, initial: Option | null = null) {
  return render(
    <EntityPicker
      name="cheeseId"
      legend="Le fromage"
      placeholder="Comté…"
      search={search}
      initial={initial}
      missing="Aucun fromage sous ce nom."
    />,
  );
}

function chosenValue(container: HTMLElement): string {
  const field = container.querySelector<HTMLInputElement>('input[name="cheeseId"]');
  if (field === null) throw new Error("the picker has no hidden field");
  return field.value;
}

describe("EntityPicker", () => {
  it("submits nothing until something is picked", () => {
    const { container } = picker(vi.fn());
    expect(chosenValue(container)).toBe("");
  });

  it("submits the id of what was picked, not its name", async () => {
    const user = userEvent.setup();
    const { container } = picker(vi.fn(async () => [COMTE, CANTAL]));

    await user.type(screen.getByRole("textbox"), "com");
    await user.click(await screen.findByText("Comté"));

    expect(chosenValue(container)).toBe("cheese-1");
  });

  it("leaves a prefilled choice alone, and lets it be taken back", async () => {
    const user = userEvent.setup();
    const { container } = picker(vi.fn(), COMTE);

    expect(chosenValue(container)).toBe("cheese-1");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Changer" }));
    expect(chosenValue(container)).toBe("");
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("does not go looking for one letter", async () => {
    const user = userEvent.setup();
    const search = vi.fn(async () => []);
    picker(search);

    await user.type(screen.getByRole("textbox"), "c");
    expect(search).not.toHaveBeenCalled();
  });

  it("says what to do when a name matches nothing", async () => {
    const user = userEvent.setup();
    picker(vi.fn(async () => []));

    await user.type(screen.getByRole("textbox"), "roquefort");
    expect(await screen.findByText("Aucun fromage sous ce nom.")).toBeInTheDocument();
  });
});
