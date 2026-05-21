import React from "react";
import { render } from "@testing-library/react-native";
import { SectionTitle } from "../src/components/SectionTitle";
import { StatusPill } from "../src/components/StatusPill";

describe("basic UI rendering", () => {
  test("SectionTitle renders eyebrow and title text", () => {
    const { getByText } = render(<SectionTitle eyebrow="Reports" title="Monthly petty cash" />);

    expect(getByText("Reports")).toBeTruthy();
    expect(getByText("Monthly petty cash")).toBeTruthy();
  });

  test("StatusPill renders the uppercased status label", () => {
    const { getByText } = render(<StatusPill status="approved" />);

    expect(getByText("APPROVED")).toBeTruthy();
  });
});
