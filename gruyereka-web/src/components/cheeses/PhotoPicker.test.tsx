import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PhotoPicker } from "@/components/cheeses/PhotoPicker";
import { MAX_PHOTO_BYTES } from "@/lib/api/schemas";

// jsdom implements neither, and the preview needs both.
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error("the picker has no file input");
  return input;
}

/** A File whose reported size is the one the test cares about. */
function sized(name: string, type: string, bytes: number): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

describe("PhotoPicker", () => {
  it("states what the API will accept, before anything is chosen", () => {
    render(<PhotoPicker />);
    expect(screen.getByText(/JPEG, PNG ou WebP/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retirer" })).not.toBeInTheDocument();
  });

  it("shows a preview of an acceptable photo and lets it be taken back", async () => {
    const user = userEvent.setup();
    const { container } = render(<PhotoPicker />);

    await user.upload(fileInput(container), sized("comte.jpg", "image/jpeg", 2048));

    expect(screen.getByRole("img", { name: /aperçu/i })).toHaveAttribute("src", "blob:preview");
    expect(screen.getByText(/comte\.jpg/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retirer" }));
    expect(screen.queryByRole("img", { name: /aperçu/i })).not.toBeInTheDocument();
  });

  it("refuses a type the upload route would bounce", async () => {
    // `accept` filters the picker, so userEvent honours it too; a real drag and
    // drop does not, which is why the component checks the type itself.
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<PhotoPicker />);

    await user.upload(fileInput(container), sized("notice.pdf", "application/pdf", 2048));

    expect(screen.getByText(/Seuls le JPEG, le PNG et le WebP/)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /aperçu/i })).not.toBeInTheDocument();
  });

  it("refuses a photo over the ceiling, and says how far over", async () => {
    const user = userEvent.setup();
    const { container } = render(<PhotoPicker />);

    await user.upload(fileInput(container), sized("enorme.png", "image/png", MAX_PHOTO_BYTES + 1));

    expect(screen.getByText(/au-delà des/)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /aperçu/i })).not.toBeInTheDocument();
  });

  it("carries a refusal the server sent back", () => {
    render(<PhotoPicker error="La photo n’a pas été acceptée par le serveur." />);
    expect(screen.getByText(/pas été acceptée par le serveur/)).toBeInTheDocument();
  });
});
