import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { changeRole } from "@/app/actions/users";
import { RoleChooser } from "@/components/admin/RoleChooser";

// The action reaches the API, which is server-only; the component's own job is
// which buttons it draws, what each one submits, and what it shows while the
// round trip is out.
vi.mock("@/app/actions/users", () => ({ changeRole: vi.fn() }));

const pretendChangeRole = vi.mocked(changeRole);

describe("RoleChooser", () => {
  it("offers the two roles the account is not in, and not the one it is", () => {
    render(<RoleChooser userId="0199a1f0-0000-7000-8000-000000000001" currentRole="USER" />);

    expect(screen.queryByRole("button", { name: "Utilisateur" })).not.toBeInTheDocument();
    expect(screen.getByText("Utilisateur")).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Modérateur" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Administrateur" })).toBeInTheDocument();
  });

  it("submits the role it names, alongside the account it moves", () => {
    const { container } = render(
      <RoleChooser userId="0199a1f0-0000-7000-8000-000000000001" currentRole="MODERATOR" />,
    );

    expect(container.querySelector('input[name="userId"]')).toHaveValue(
      "0199a1f0-0000-7000-8000-000000000001",
    );
    expect(screen.getByRole("button", { name: "Administrateur" })).toHaveAttribute(
      "value",
      "ADMIN",
    );
    expect(screen.getByRole("button", { name: "Utilisateur" })).toHaveAttribute("value", "USER");
  });

  it("reads the roles as words, never as codes", () => {
    render(<RoleChooser userId="0199a1f0-0000-7000-8000-000000000001" currentRole="ADMIN" />);
    expect(screen.queryByText(/MODERATOR|ADMIN|USER/)).not.toBeInTheDocument();
  });

  it("marks the role being applied, and bars the others until it lands", async () => {
    const user = userEvent.setup();
    // A call that never settles: the component is left in the state it holds
    // while the server is thinking.
    pretendChangeRole.mockImplementation(() => new Promise(() => {}));
    render(<RoleChooser userId="0199a1f0-0000-7000-8000-000000000001" currentRole="USER" />);

    const promote = screen.getByRole("button", { name: "Modérateur" });
    await user.click(promote);

    expect(promote.closest("form")).toHaveAttribute("aria-busy", "true");
    expect(promote.querySelector("svg")).toBeInTheDocument();
    expect(promote).toBeDisabled();

    const untouched = screen.getByRole("button", { name: "Administrateur" });
    expect(untouched).toBeDisabled();
    expect(untouched.querySelector("svg")).not.toBeInTheDocument();
  });
});
