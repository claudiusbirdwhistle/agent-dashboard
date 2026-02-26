import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DirectiveForm from "@/components/directives/DirectiveForm";

describe("DirectiveForm", () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it("renders the text area", () => {
    render(<DirectiveForm onSubmit={mockOnSubmit} />);
    expect(
      screen.getByPlaceholderText(/what should the agent do/i)
    ).toBeInTheDocument();
  });

  it("renders type selector buttons", () => {
    render(<DirectiveForm onSubmit={mockOnSubmit} />);
    expect(screen.getByRole("button", { name: /^task$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^focus$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^policy$/i })).toBeInTheDocument();
  });

  it("renders priority selector buttons", () => {
    render(<DirectiveForm onSubmit={mockOnSubmit} />);
    expect(screen.getByRole("button", { name: /urgent/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /normal/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /background/i })
    ).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<DirectiveForm onSubmit={mockOnSubmit} />);
    expect(
      screen.getByRole("button", { name: /submit/i })
    ).toBeInTheDocument();
  });

  it("does not submit when text is empty", async () => {
    const user = userEvent.setup();
    render(<DirectiveForm onSubmit={mockOnSubmit} />);
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("does not submit when text is only whitespace", async () => {
    const user = userEvent.setup();
    render(<DirectiveForm onSubmit={mockOnSubmit} />);
    await user.type(
      screen.getByPlaceholderText(/what should the agent do/i),
      "   "
    );
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with text, type, and priority when valid", async () => {
    const user = userEvent.setup();
    render(<DirectiveForm onSubmit={mockOnSubmit} />);
    await user.type(
      screen.getByPlaceholderText(/what should the agent do/i),
      "Add CORS headers"
    );
    await user.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        text: "Add CORS headers",
        type: "task",
        priority: "normal",
      });
    });
  });

  it("allows changing type to focus", async () => {
    const user = userEvent.setup();
    render(<DirectiveForm onSubmit={mockOnSubmit} />);
    await user.type(
      screen.getByPlaceholderText(/what should the agent do/i),
      "Focus on testing"
    );
    await user.click(screen.getByRole("button", { name: /focus/i }));
    await user.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        text: "Focus on testing",
        type: "focus",
        priority: "normal",
      });
    });
  });

  it("allows changing priority to urgent", async () => {
    const user = userEvent.setup();
    render(<DirectiveForm onSubmit={mockOnSubmit} />);
    await user.type(
      screen.getByPlaceholderText(/what should the agent do/i),
      "Urgent task"
    );
    await user.click(screen.getByRole("button", { name: /urgent/i }));
    await user.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        text: "Urgent task",
        type: "task",
        priority: "urgent",
      });
    });
  });

  it("clears the text area after successful submit", async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);
    render(<DirectiveForm onSubmit={mockOnSubmit} />);
    const textarea = screen.getByPlaceholderText(/what should the agent do/i);
    await user.type(textarea, "Some directive");
    await user.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => {
      expect(textarea).toHaveValue("");
    });
  });

  it("disables submit button while submitting", async () => {
    let resolveSubmit: () => void;
    const pendingSubmit = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    mockOnSubmit.mockReturnValue(pendingSubmit);

    const user = userEvent.setup();
    render(<DirectiveForm onSubmit={mockOnSubmit} />);
    await user.type(
      screen.getByPlaceholderText(/what should the agent do/i),
      "Some directive"
    );
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled();
    });

    resolveSubmit!();
  });
});
