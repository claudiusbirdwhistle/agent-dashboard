/**
 * Tests for ModelSwitcher component with auto-model toggle.
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the hooks
const mockAgentModel = { model: "claude-sonnet-4-6", label: "Sonnet" };
const mockSetModel = { mutate: jest.fn(), isPending: false, isError: false };
const mockAutoModel = { enabled: true, minimumModel: "claude-sonnet-4-6" };
const mockSetAutoModel = { mutate: jest.fn(), isPending: false };

jest.mock("@/lib/hooks/useAgentModel", () => ({
  useAgentModel: () => ({ data: mockAgentModel, isLoading: false }),
  useSetAgentModel: () => mockSetModel,
}));

jest.mock("@/lib/hooks/useAutoModel", () => ({
  useAutoModel: () => ({ data: mockAutoModel, isLoading: false }),
  useSetAutoModel: () => mockSetAutoModel,
}));

import ModelSwitcher from "@/components/directives/ModelSwitcher";

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("ModelSwitcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAutoModel.enabled = true;
    mockAutoModel.minimumModel = "claude-sonnet-4-6";
    mockAgentModel.model = "claude-sonnet-4-6";
  });

  it("renders model buttons", () => {
    renderWithQuery(<ModelSwitcher />);
    // Model names appear in buttons (and in minimum select when auto is on)
    expect(screen.getAllByText("Haiku").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sonnet").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Opus").length).toBeGreaterThanOrEqual(1);
  });

  it("shows auto-model toggle", () => {
    renderWithQuery(<ModelSwitcher />);
    expect(screen.getByText(/auto/i)).toBeInTheDocument();
  });

  it("indicates auto-model is enabled", () => {
    renderWithQuery(<ModelSwitcher />);
    // Should show an indicator that auto-model is on
    const toggle = screen.getByRole("checkbox");
    expect(toggle).toBeChecked();
  });

  it("calls setAutoModel when toggle is clicked", () => {
    renderWithQuery(<ModelSwitcher />);
    const toggle = screen.getByRole("checkbox");
    fireEvent.click(toggle);
    expect(mockSetAutoModel.mutate).toHaveBeenCalledWith({ enabled: false });
  });

  it("shows minimum model selector when auto is enabled", () => {
    renderWithQuery(<ModelSwitcher />);
    expect(screen.getByText(/minimum/i)).toBeInTheDocument();
  });

  it("disables manual model buttons when auto is enabled", () => {
    renderWithQuery(<ModelSwitcher />);
    const buttons = screen.getAllByRole("button");
    // Model buttons should be disabled in auto mode
    const modelButtons = buttons.filter(
      (b) => b.textContent?.includes("Haiku") || b.textContent?.includes("Sonnet") || b.textContent?.includes("Opus")
    );
    modelButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it("enables manual model buttons when auto is disabled", () => {
    mockAutoModel.enabled = false;
    renderWithQuery(<ModelSwitcher />);
    const buttons = screen.getAllByRole("button");
    const sonnetBtn = buttons.find((b) => b.textContent?.includes("Sonnet"));
    // Active model button might be disabled (can't switch to current), but others should not be
    const opusBtn = buttons.find((b) => b.textContent?.includes("Opus"));
    expect(opusBtn).not.toBeDisabled();
  });
});
