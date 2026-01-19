import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders Notes header", () => {
  render(<App />);
  const header = screen.getByText(/Notes/i);
  expect(header).toBeInTheDocument();
});
