import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PhotoPicker } from "@/components/tastings/PhotoPicker";
import { MAX_PHOTO_BYTES } from "@/lib/api/schemas";

// jsdom implements neither, and the previews need both.
beforeAll(() => {
  let made = 0;
  URL.createObjectURL = vi.fn(() => `blob:preview-${made++}`);
  URL.revokeObjectURL = vi.fn();
});

/** The picker is controlled; this holds the files the way a form would. */
function Harness({ max = 10, error }: { max?: number; error?: string }) {
  const [files, setFiles] = useState<File[]>([]);
  return <PhotoPicker files={files} onChange={setFiles} max={max} error={error} />;
}

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

const jpeg = (name: string) => sized(name, "image/jpeg", 2048);

describe("PhotoPicker", () => {
  it("states what the API will accept, before anything is chosen", () => {
    render(<Harness />);
    expect(screen.getByText(/JPEG, PNG ou WebP/)).toBeInTheDocument();
    expect(screen.getByText(/0 sur 10/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("previews several photos, and adds a second pick to the first", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.upload(fileInput(container), [jpeg("comte.jpg"), jpeg("brie.jpg")]);
    await user.upload(fileInput(container), jpeg("ossau.jpg"));

    expect(screen.getAllByRole("img", { name: /^Aperçu de/ })).toHaveLength(3);
    expect(screen.getByRole("img", { name: "Aperçu de ossau.jpg" })).toHaveAttribute(
      "src",
      expect.stringMatching(/^blob:preview-/),
    );
    expect(screen.getByText(/3 sur 10/)).toBeInTheDocument();
  });

  it("takes one photo back and leaves the others", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.upload(fileInput(container), [jpeg("comte.jpg"), jpeg("brie.jpg")]);
    await user.click(screen.getByRole("button", { name: "Retirer comte.jpg" }));

    expect(screen.queryByRole("img", { name: "Aperçu de comte.jpg" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Aperçu de brie.jpg" })).toBeInTheDocument();
  });

  it("refuses a type the upload route would bounce, and keeps the good ones", async () => {
    // `accept` filters the picker, so userEvent honours it too; a real drag and
    // drop does not, which is why the component checks the type itself.
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<Harness />);

    await user.upload(fileInput(container), [
      sized("notice.pdf", "application/pdf", 2048),
      jpeg("comte.jpg"),
    ]);

    expect(screen.getByText(/notice\.pdf : Seuls le JPEG, le PNG et le WebP/)).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /^Aperçu de/ })).toHaveLength(1);
  });

  it("refuses a photo over the ceiling, and says how far over", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.upload(fileInput(container), sized("enorme.png", "image/png", MAX_PHOTO_BYTES + 1));

    expect(screen.getByText(/enorme\.png : .*au-delà des/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("stops at the room left, names what did not fit, and hides the input once full", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness max={2} />);

    await user.upload(fileInput(container), [jpeg("a.jpg"), jpeg("b.jpg"), jpeg("c.jpg")]);

    expect(screen.getAllByRole("img", { name: /^Aperçu de/ })).toHaveLength(2);
    expect(screen.getByText(/c\.jpg : 2 photos au plus/)).toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeNull();

    await user.click(screen.getByRole("button", { name: "Retirer a.jpg" }));
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
  });

  it("carries a refusal the server sent back", () => {
    render(<Harness error="Les photos n’ont pas été acceptées par le serveur." />);
    expect(screen.getByText(/pas été acceptées par le serveur/)).toBeInTheDocument();
  });
});
