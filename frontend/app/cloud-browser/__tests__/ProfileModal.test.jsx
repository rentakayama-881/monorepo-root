import { render, screen, fireEvent } from "@testing-library/react";
import ProfileModal from "../ProfileModal";

jest.mock("@/components/ui/Portal", () => ({
  __esModule: true,
  default: ({ children }) => children,
}));

describe("ProfileModal", () => {
  const defaultProps = {
    open: true,
    profile: null,
    onSave: jest.fn(),
    onClose: jest.fn(),
    saving: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders create mode", () => {
    render(<ProfileModal {...defaultProps} />);

    expect(screen.getByText("Profil Baru")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nama Profil/)).toHaveValue("");
    expect(screen.getByText("Simpan")).toBeInTheDocument();
  });

  it("renders edit mode with pre-filled data", () => {
    const profile = {
      id: "p1",
      name: "Browser Kantor",
      proxy_server: "socks5://proxy.example.com:1080",
      proxy_username: "user1",
      proxy_password: "pass1",
      notes: "Untuk kerja",
    };

    render(<ProfileModal {...defaultProps} profile={profile} />);

    expect(screen.getByText("Edit Profil")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nama Profil/)).toHaveValue("Browser Kantor");
    expect(screen.getByLabelText(/Proxy Server/)).toHaveValue("socks5://proxy.example.com:1080");
  });

  it("validates required name field", () => {
    render(<ProfileModal {...defaultProps} />);

    const submitButton = screen.getByText("Simpan");
    fireEvent.click(submitButton);

    expect(screen.getByText("Nama profil wajib diisi.")).toBeInTheDocument();
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });
});
