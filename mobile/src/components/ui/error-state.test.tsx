/// <reference types="jest" />
import { fireEvent, render } from "@testing-library/react-native";
import { ErrorState } from "./error-state";

describe("ErrorState", () => {
  it("renders the message", async () => {
    const { getByText } = await render(<ErrorState message="Something broke." />);
    expect(getByText("Something broke.")).toBeTruthy();
  });

  it("shows a retry button that calls onRetry when pressed", async () => {
    const onRetry = jest.fn();
    const { getByText } = await render(
      <ErrorState message="Something broke." onRetry={onRetry} />,
    );
    fireEvent.press(getByText("Try again"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the retry button when no onRetry is provided", async () => {
    const { queryByText } = await render(<ErrorState message="Something broke." />);
    expect(queryByText("Try again")).toBeNull();
  });
});
