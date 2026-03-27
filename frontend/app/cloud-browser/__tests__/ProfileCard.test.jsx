import { render, screen, fireEvent } from "@testing-library/react";
import ProfileCard from "../ProfileCard";

function createProfile(overrides = {}) {
  return {
    id: "p1",
    name: "Profil Utama",
    proxy_server: "",
    proxy_host: "",
    platform: "Win32",
    last_used_at: null,
    updated_at: null,
    ...overrides,
  };
}

const defaultHandlers = {
  onStart: jest.fn(),
  onViewSession: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  starting: false,
  activeSession: null,
};

describe("ProfileCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders profile name", () => {
    render(<ProfileCard profile={createProfile({ name: "Browser Kerja" })} {...defaultHandlers} />);
    expect(screen.getByText("Browser Kerja")).toBeInTheDocument();
  });

  it("renders proxy badge when proxy set", () => {
    render(
      <ProfileCard
        profile={createProfile({ proxy_server: "socks5://proxy.example.com:1080" })}
        {...defaultHandlers}
      />
    );
    expect(screen.getByText("Proxy aktif")).toBeInTheDocument();
  });

  it("renders 'Tanpa proxy' when no proxy", () => {
    render(
      <ProfileCard
        profile={createProfile({ proxy_server: "", proxy_host: "" })}
        {...defaultHandlers}
      />
    );
    expect(screen.getByText("Tanpa proxy")).toBeInTheDocument();
  });

  it("calls onStart when start button clicked", () => {
    const onStart = jest.fn();
    const profile = createProfile();

    render(<ProfileCard profile={profile} {...defaultHandlers} onStart={onStart} />);

    const startButton = screen.getByRole("button", { name: /Mulai Sesi/i });
    fireEvent.click(startButton);
    expect(onStart).toHaveBeenCalledWith(profile);
  });
});
