/// <reference types="jest" />
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the message", async () => {
    const { getByText } = await render(<EmptyState message="No tickets yet." />);
    expect(getByText("No tickets yet.")).toBeTruthy();
  });

  it("renders children below the message", async () => {
    const { getByText } = await render(
      <EmptyState message="No users yet.">
        <Text>Create one</Text>
      </EmptyState>,
    );
    expect(getByText("No users yet.")).toBeTruthy();
    expect(getByText("Create one")).toBeTruthy();
  });
});
