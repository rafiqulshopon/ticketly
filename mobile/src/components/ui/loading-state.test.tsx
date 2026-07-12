/// <reference types="jest" />
import { render } from "@testing-library/react-native";
import { LoadingState } from "./loading-state";

describe("LoadingState", () => {
  it("renders without crashing", async () => {
    const { toJSON } = await render(<LoadingState />);
    expect(toJSON()).not.toBeNull();
  });

  it("shows the optional label when provided", async () => {
    const { getByText } = await render(<LoadingState label="Loading tickets…" />);
    expect(getByText("Loading tickets…")).toBeTruthy();
  });
});
