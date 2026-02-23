import { render, screen, waitFor } from "@testing-library/react";
import TelegramAuthSection from "../TelegramAuthSection";

const mockFetchJsonAuth = jest.fn();

jest.mock("@/lib/api", () => ({
  fetchJsonAuth: (...args) => mockFetchJsonAuth(...args),
}));

function disconnectedAuth() {
  return { connected: false };
}

function connectedAuth() {
  return {
    connected: true,
    telegram_user_id: "123456789",
    username: "aivalid_bot_user",
    display_username: "@aivalid_bot_user",
    deep_link: "https://t.me/aivalid_bot_user",
    verified_at: "2026-02-23T00:00:00Z",
  };
}

describe("TelegramAuthSection", () => {
  beforeEach(() => {
    mockFetchJsonAuth.mockReset();
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "aivalid_bot";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  });

  it("removes telegram widget artifacts when auth switches to connected", async () => {
    const { rerender } = render(
      <TelegramAuthSection telegramAuth={disconnectedAuth()} onTelegramAuthChange={jest.fn()} />
    );

    const widgetContainer = await screen.findByTestId("telegram-widget-container");
    expect(widgetContainer.querySelector('script[src*="telegram-widget.js"]')).not.toBeNull();

    const orphanTelegramFrame = document.createElement("iframe");
    orphanTelegramFrame.id = "telegram-login-aivalid-bot-orphan";
    orphanTelegramFrame.src = "https://oauth.telegram.org/embed/aivalid_bot?origin=https%3A%2F%2Faivalid.id";
    document.body.appendChild(orphanTelegramFrame);

    const unrelatedFrame = document.createElement("iframe");
    unrelatedFrame.id = "non-telegram-widget";
    unrelatedFrame.src = "https://example.com/widget";
    document.body.appendChild(unrelatedFrame);

    rerender(<TelegramAuthSection telegramAuth={connectedAuth()} onTelegramAuthChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.queryByTestId("telegram-widget-container")).not.toBeInTheDocument();
      expect(document.getElementById("telegram-login-aivalid-bot-orphan")).not.toBeInTheDocument();
      expect(document.querySelector('script[src*="telegram-widget.js"]')).toBeNull();
    });

    expect(document.getElementById("non-telegram-widget")).toBeInTheDocument();
  });

  it("cleans orphan widget iframe on unmount", async () => {
    const { unmount } = render(
      <TelegramAuthSection telegramAuth={disconnectedAuth()} onTelegramAuthChange={jest.fn()} />
    );

    await screen.findByTestId("telegram-widget-container");

    const orphanTelegramFrame = document.createElement("iframe");
    orphanTelegramFrame.id = "telegram-login-aivalid-bot-unmount";
    orphanTelegramFrame.src = "https://oauth.telegram.org/embed/aivalid_bot?origin=https%3A%2F%2Faivalid.id";
    document.body.appendChild(orphanTelegramFrame);
    expect(document.getElementById("telegram-login-aivalid-bot-unmount")).toBeInTheDocument();

    unmount();

    await waitFor(() => {
      expect(document.getElementById("telegram-login-aivalid-bot-unmount")).not.toBeInTheDocument();
      expect(document.querySelector('script[src*="telegram-widget.js"]')).toBeNull();
    });
  });
});
